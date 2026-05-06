/*
  # Remise/retour par QR code dynamique

  Remplace le double-clic flag-based par un scan physique. Voir le plan
  /Users/folier/.claude/plans/imperative-zooming-clock.md pour le contexte
  complet et les choix de design.

  - Une table `handover_qr_tokens` (single-use, ~90s TTL) stocke chaque
    code émis. RLS sans policy → impossible à lire/écrire depuis le
    client. Seules les RPCs (DEFINER) accèdent.
  - Deux RPCs : `issue_handover_token` (l'owner pour la remise, le renter
    pour le retour) et `redeem_handover_token` (la partie opposée scanne).
  - Atomicité : la redemption flippe les flags + status + timestamp dans
    un seul UPDATE, avec rollback de la marque redeemed_at si la
    transition échoue (course concurrente).
  - Anti-replay (redeemed_at IS NULL guard), anti-self-scan (caller
    role != issuer role), et expiration TTL 90s.
*/

-- Audit field: when the handover physically happened (server-stamped).
-- The return uses the existing return_confirmed_at.
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS handover_at timestamptz;

-- One row per QR token issued. Single-use, ~90s TTL.
CREATE TABLE IF NOT EXISTS public.handover_qr_tokens (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id    uuid NOT NULL REFERENCES public.bookings(id) ON DELETE CASCADE,
  event_type    text NOT NULL CHECK (event_type IN ('handover','return')),
  issuer_id     uuid NOT NULL REFERENCES public.profiles(id),
  issuer_role   text NOT NULL CHECK (issuer_role IN ('owner','renter')),
  token         text NOT NULL UNIQUE,
  numeric_code  text NOT NULL CHECK (numeric_code ~ '^[0-9]{6}$'),
  issued_at     timestamptz NOT NULL DEFAULT now(),
  expires_at    timestamptz NOT NULL,
  redeemed_at   timestamptz,
  redeemed_by   uuid REFERENCES public.profiles(id)
);

CREATE INDEX IF NOT EXISTS idx_handover_qr_active
  ON public.handover_qr_tokens (booking_id, event_type)
  WHERE redeemed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_handover_qr_token
  ON public.handover_qr_tokens (token)
  WHERE redeemed_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_handover_qr_numeric_code
  ON public.handover_qr_tokens (booking_id, numeric_code)
  WHERE redeemed_at IS NULL;

-- RLS: no policies = no client access. RPCs (DEFINER) bypass.
ALTER TABLE public.handover_qr_tokens ENABLE ROW LEVEL SECURITY;

-- ---------------------------------------------------------------------------
-- RPC: issue_handover_token
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.issue_handover_token(
  p_booking_id uuid,
  p_event_type text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller        uuid := auth.uid();
  v_booking       public.bookings%ROWTYPE;
  v_is_owner      boolean;
  v_is_renter     boolean;
  v_required_role text;
  v_required_status text;
  v_token         text;
  v_numeric_code  text;
  v_expires_at    timestamptz;
  v_id            uuid;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('error', 'Non authentifié');
  END IF;

  IF p_event_type NOT IN ('handover','return') THEN
    RETURN jsonb_build_object('error', 'event_type invalide');
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Réservation introuvable');
  END IF;

  v_is_owner  := (v_booking.owner_id  = v_caller);
  v_is_renter := (v_booking.renter_id = v_caller);

  IF NOT (v_is_owner OR v_is_renter) THEN
    RETURN jsonb_build_object('error', 'Accès refusé');
  END IF;

  IF p_event_type = 'handover' THEN
    v_required_role   := 'owner';
    v_required_status := 'active';
  ELSE
    v_required_role   := 'renter';
    v_required_status := 'in_progress';
  END IF;

  IF v_booking.status <> v_required_status THEN
    RETURN jsonb_build_object(
      'error',
      CASE WHEN p_event_type = 'handover'
           THEN 'Remise non disponible dans cet état'
           ELSE 'Retour non disponible dans cet état'
      END
    );
  END IF;

  IF (v_required_role = 'owner' AND NOT v_is_owner) OR
     (v_required_role = 'renter' AND NOT v_is_renter) THEN
    RETURN jsonb_build_object(
      'error',
      CASE WHEN p_event_type = 'handover'
           THEN 'Le propriétaire doit afficher le QR de remise'
           ELSE 'Le locataire doit afficher le QR de retour'
      END
    );
  END IF;

  -- Expire any live tokens for this (booking, event). UI rotation calls
  -- this RPC again, so we keep at most one valid token at a time.
  UPDATE public.handover_qr_tokens
  SET expires_at = now()
  WHERE booking_id = p_booking_id
    AND event_type = p_event_type
    AND redeemed_at IS NULL
    AND expires_at > now();

  v_token := translate(
    encode(gen_random_bytes(32), 'base64'),
    '+/=', '-_'
  );
  v_numeric_code := lpad((floor(random() * 1000000))::text, 6, '0');
  v_expires_at := now() + interval '90 seconds';

  INSERT INTO public.handover_qr_tokens (
    booking_id, event_type, issuer_id, issuer_role,
    token, numeric_code, issued_at, expires_at
  ) VALUES (
    p_booking_id, p_event_type, v_caller, v_required_role,
    v_token, v_numeric_code, now(), v_expires_at
  )
  RETURNING id INTO v_id;

  RETURN jsonb_build_object(
    'success', true,
    'id', v_id,
    'event_type', p_event_type,
    'token', v_token,
    'numeric_code', v_numeric_code,
    'expires_at', v_expires_at
  );
END;
$function$;

-- ---------------------------------------------------------------------------
-- RPC: redeem_handover_token
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.redeem_handover_token(
  p_booking_id uuid,
  p_event_type text,
  p_input      text
) RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller       uuid := auth.uid();
  v_booking      public.bookings%ROWTYPE;
  v_is_owner     boolean;
  v_is_renter    boolean;
  v_token_row    public.handover_qr_tokens%ROWTYPE;
  v_required_redeemer_role text;
  v_caller_role  text;
  v_redeem_count int;
  v_status_count int;
  v_new_status   text;
BEGIN
  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('error', 'Non authentifié');
  END IF;

  IF p_event_type NOT IN ('handover','return') THEN
    RETURN jsonb_build_object('error', 'event_type invalide');
  END IF;

  IF p_input IS NULL OR length(p_input) < 6 THEN
    RETURN jsonb_build_object('error', 'Code invalide');
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;
  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Réservation introuvable');
  END IF;

  v_is_owner  := (v_booking.owner_id  = v_caller);
  v_is_renter := (v_booking.renter_id = v_caller);

  IF NOT (v_is_owner OR v_is_renter) THEN
    RETURN jsonb_build_object('error', 'Accès refusé');
  END IF;

  v_caller_role := CASE WHEN v_is_owner THEN 'owner' ELSE 'renter' END;
  v_required_redeemer_role := CASE WHEN p_event_type = 'handover' THEN 'renter' ELSE 'owner' END;

  IF v_caller_role <> v_required_redeemer_role THEN
    RETURN jsonb_build_object(
      'error',
      CASE WHEN p_event_type = 'handover'
           THEN 'Seul le locataire peut scanner ce QR'
           ELSE 'Seul le propriétaire peut scanner ce QR'
      END
    );
  END IF;

  SELECT * INTO v_token_row
  FROM public.handover_qr_tokens
  WHERE booking_id = p_booking_id
    AND event_type = p_event_type
    AND redeemed_at IS NULL
    AND expires_at > now()
    AND (token = p_input OR numeric_code = p_input)
  ORDER BY issued_at DESC
  LIMIT 1;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Code invalide ou expiré');
  END IF;

  -- Atomic single-use redemption.
  UPDATE public.handover_qr_tokens
  SET redeemed_at = now(), redeemed_by = v_caller
  WHERE id = v_token_row.id AND redeemed_at IS NULL;
  GET DIAGNOSTICS v_redeem_count = ROW_COUNT;

  IF v_redeem_count = 0 THEN
    RETURN jsonb_build_object('error', 'Code déjà utilisé');
  END IF;

  -- Atomic state transition. Roll back the redemption if the booking
  -- moved out of the expected status.
  IF p_event_type = 'handover' THEN
    UPDATE public.bookings
    SET handover_confirmed_owner  = true,
        handover_confirmed_renter = true,
        status                    = 'in_progress',
        handover_at               = now()
    WHERE id = p_booking_id AND status = 'active';
    v_new_status := 'in_progress';
  ELSE
    UPDATE public.bookings
    SET return_confirmed_owner  = true,
        return_confirmed_renter = true,
        status                  = 'pending_owner_validation',
        return_confirmed_at     = now()
    WHERE id = p_booking_id AND status = 'in_progress';
    v_new_status := 'pending_owner_validation';
  END IF;
  GET DIAGNOSTICS v_status_count = ROW_COUNT;

  IF v_status_count = 0 THEN
    UPDATE public.handover_qr_tokens
    SET redeemed_at = NULL, redeemed_by = NULL
    WHERE id = v_token_row.id;
    RETURN jsonb_build_object('error', 'État de la réservation incompatible');
  END IF;

  RETURN jsonb_build_object(
    'success', true,
    'event_type', p_event_type,
    'new_status', v_new_status
  );
END;
$function$;

GRANT EXECUTE ON FUNCTION public.issue_handover_token(uuid, text) TO authenticated;
GRANT EXECUTE ON FUNCTION public.redeem_handover_token(uuid, text, text) TO authenticated;
