/*
  # Fix update_booking_status RPC: align with actual column names

  Background: migration 20260415220823_20260415_harden_rls_profiles_chat_bookings
  defined update_booking_status() referencing column names like
  owner_handover_confirmed and renter_handover_confirmed. Those columns do
  not exist on public.bookings — the actual schema uses handover_confirmed_owner,
  handover_confirmed_renter, return_confirmed_owner, return_confirmed_renter
  (added by 20260403115139_add_handover_return_confirmation_fields).

  CREATE FUNCTION accepts late-bound column references at definition time, so
  the original migration succeeded silently; the function only failed at the
  first call. The version currently running in production already had the
  correct names (patched out-of-band). This migration reconciles the source
  tree with prod so a fresh `supabase db reset` produces the same definition.

  No behavior change vs prod. Only column renames.
*/

CREATE OR REPLACE FUNCTION public.update_booking_status(
  p_booking_id uuid,
  p_new_status text,
  p_extra      jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_booking bookings%ROWTYPE;
  v_caller uuid;
  v_is_owner boolean;
  v_is_renter boolean;
  v_allowed_statuses text[];
  v_allowed_extra_keys text[] := ARRAY[
    'handover_confirmed_owner', 'handover_confirmed_renter',
    'return_confirmed_owner',   'return_confirmed_renter',
    'return_confirmed_at',      'owner_validated'
  ];
  v_key text;
BEGIN
  v_caller := auth.uid();

  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Booking not found');
  END IF;

  v_is_owner  := (v_booking.owner_id  = v_caller);
  v_is_renter := (v_booking.renter_id = v_caller);

  IF NOT (v_is_owner OR v_is_renter) THEN
    RETURN jsonb_build_object('error', 'Access denied');
  END IF;

  -- Field-only update path (no status change)
  IF p_new_status = v_booking.status AND p_extra != '{}'::jsonb THEN
    FOR v_key IN SELECT k FROM jsonb_object_keys(p_extra) AS k LOOP
      IF NOT (v_key = ANY(v_allowed_extra_keys)) THEN
        RETURN jsonb_build_object('error', 'Field not allowed: ' || v_key);
      END IF;
    END LOOP;

    UPDATE public.bookings
    SET
      handover_confirmed_owner  = COALESCE((p_extra->>'handover_confirmed_owner')::boolean,  handover_confirmed_owner),
      handover_confirmed_renter = COALESCE((p_extra->>'handover_confirmed_renter')::boolean, handover_confirmed_renter),
      return_confirmed_owner    = COALESCE((p_extra->>'return_confirmed_owner')::boolean,    return_confirmed_owner),
      return_confirmed_renter   = COALESCE((p_extra->>'return_confirmed_renter')::boolean,   return_confirmed_renter),
      return_confirmed_at       = COALESCE((p_extra->>'return_confirmed_at')::timestamptz,   return_confirmed_at),
      owner_validated           = COALESCE((p_extra->>'owner_validated')::boolean,           owner_validated)
    WHERE id = p_booking_id;

    RETURN jsonb_build_object('success', true);
  END IF;

  -- Transition matrix
  IF v_is_owner THEN
    CASE v_booking.status
      WHEN 'pending'                  THEN v_allowed_statuses := ARRAY['accepted', 'refused'];
      WHEN 'pending_payment'          THEN v_allowed_statuses := ARRAY['accepted', 'refused'];
      WHEN 'active'                   THEN v_allowed_statuses := ARRAY['in_progress'];
      WHEN 'in_progress'              THEN v_allowed_statuses := ARRAY['pending_owner_validation', 'disputed'];
      WHEN 'pending_owner_validation' THEN v_allowed_statuses := ARRAY['completed', 'disputed'];
      ELSE                                 v_allowed_statuses := ARRAY[]::text[];
    END CASE;
  END IF;

  IF v_is_renter AND NOT v_is_owner THEN
    CASE v_booking.status
      WHEN 'accepted'                 THEN v_allowed_statuses := ARRAY['pending_payment'];
      WHEN 'active'                   THEN v_allowed_statuses := ARRAY['in_progress'];
      WHEN 'in_progress'              THEN v_allowed_statuses := ARRAY['pending_owner_validation'];
      WHEN 'pending_owner_validation' THEN v_allowed_statuses := ARRAY['disputed'];
      ELSE                                 v_allowed_statuses := ARRAY[]::text[];
    END CASE;
  END IF;

  IF NOT (p_new_status = ANY(v_allowed_statuses)) THEN
    RETURN jsonb_build_object(
      'error', 'Transition not allowed: ' || v_booking.status || ' → ' || p_new_status
    );
  END IF;

  UPDATE public.bookings
  SET
    status                    = p_new_status,
    handover_confirmed_owner  = COALESCE((p_extra->>'handover_confirmed_owner')::boolean,  handover_confirmed_owner),
    handover_confirmed_renter = COALESCE((p_extra->>'handover_confirmed_renter')::boolean, handover_confirmed_renter),
    return_confirmed_owner    = COALESCE((p_extra->>'return_confirmed_owner')::boolean,    return_confirmed_owner),
    return_confirmed_renter   = COALESCE((p_extra->>'return_confirmed_renter')::boolean,   return_confirmed_renter),
    return_confirmed_at       = COALESCE((p_extra->>'return_confirmed_at')::timestamptz,   return_confirmed_at),
    owner_validated           = COALESCE((p_extra->>'owner_validated')::boolean,           owner_validated)
  WHERE id = p_booking_id;

  RETURN jsonb_build_object('success', true, 'new_status', p_new_status);
END;
$$;
