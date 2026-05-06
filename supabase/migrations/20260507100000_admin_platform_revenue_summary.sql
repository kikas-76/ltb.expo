/*
  # admin_platform_revenue_summary RPC

  Revenus plateforme = ce qui finit dans notre poche, posé sur Stripe via le
  application_fee à la création de la PaymentIntent (cf. supabase/functions/
  create-payment-intent/index.ts:215). Pour chaque booking dont le PI loyer a
  été capturé (status >= active), la somme = total_price × (renter_fee_percent
  + owner_commission_percent) / 100.

  L'agrégat est calculé serveur-side via cette RPC SECURITY DEFINER. Les
  pourcentages vivent sur la table listings (renter_fee_percent par défaut 7,
  owner_commission_percent par défaut 8) — la RPC fait le JOIN.

  Renvoie {all_time, this_month} avec breakdown frais locataire / commission
  propriétaire pour comprendre d'où vient le revenu.
*/

CREATE OR REPLACE FUNCTION public.admin_platform_revenue_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller_id   uuid := auth.uid();
  v_caller_role text;
  v_month_start timestamptz := date_trunc('month', now());
  v_result      jsonb;
BEGIN
  -- Defensive auth: refuse if no JWT-authenticated caller. Without the
  -- IS NULL check, a service-role connection would have v_caller_role = NULL
  -- and the `<> 'admin'` test would silently evaluate to NULL/false, leaking
  -- the figures.
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Non authentifié');
  END IF;

  SELECT role INTO v_caller_role FROM public.profiles WHERE id = v_caller_id;
  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RETURN jsonb_build_object('error', 'Accès refusé');
  END IF;

  WITH paid_bookings AS (
    SELECT
      b.created_at,
      b.total_price::numeric                                      AS rental,
      COALESCE(l.renter_fee_percent, 7)::numeric                  AS renter_fee_pct,
      COALESCE(l.owner_commission_percent, 8)::numeric            AS owner_comm_pct
    FROM public.bookings b
    JOIN public.listings l ON l.id = b.listing_id
    WHERE b.stripe_rental_payment_intent_id IS NOT NULL
      AND b.status IN ('active','in_progress','pending_return','pending_owner_validation','completed','disputed')
  ),
  all_time AS (
    SELECT
      sum(rental * renter_fee_pct  / 100.0) AS renter_fee,
      sum(rental * owner_comm_pct / 100.0)  AS owner_commission,
      count(*)                              AS bookings_count,
      sum(rental)                           AS gross_rental
    FROM paid_bookings
  ),
  this_month AS (
    SELECT
      sum(rental * renter_fee_pct  / 100.0) AS renter_fee,
      sum(rental * owner_comm_pct / 100.0)  AS owner_commission,
      count(*)                              AS bookings_count,
      sum(rental)                           AS gross_rental
    FROM paid_bookings
    WHERE created_at >= v_month_start
  )
  SELECT jsonb_build_object(
    'all_time', jsonb_build_object(
      'renter_fee',       COALESCE((SELECT renter_fee       FROM all_time), 0),
      'owner_commission', COALESCE((SELECT owner_commission FROM all_time), 0),
      'total',            COALESCE((SELECT renter_fee + owner_commission FROM all_time), 0),
      'bookings_count',   COALESCE((SELECT bookings_count   FROM all_time), 0),
      'gross_rental',     COALESCE((SELECT gross_rental     FROM all_time), 0)
    ),
    'this_month', jsonb_build_object(
      'renter_fee',       COALESCE((SELECT renter_fee       FROM this_month), 0),
      'owner_commission', COALESCE((SELECT owner_commission FROM this_month), 0),
      'total',            COALESCE((SELECT renter_fee + owner_commission FROM this_month), 0),
      'bookings_count',   COALESCE((SELECT bookings_count   FROM this_month), 0),
      'gross_rental',     COALESCE((SELECT gross_rental     FROM this_month), 0)
    ),
    'computed_at', now()
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.admin_platform_revenue_summary() TO authenticated;
