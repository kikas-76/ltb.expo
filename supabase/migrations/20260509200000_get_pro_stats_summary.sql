/*
  # RPC get_pro_stats_summary : tableau de bord pro

  Agrège en un seul jsonb les KPIs, revenus, activité 6 mois, funnel
  de conversion, top annonces, derniers avis et statut Stripe pour
  l'utilisateur courant. Évite N+1 requêtes côté client.

  Sécurité :
  - auth.uid() IS NOT NULL (sinon "Non authentifié")
  - profiles.is_pro = true (sinon "Réservé aux comptes pro")
  - Toutes les sous-requêtes filtrent sur owner_id = v_caller_id

  Source de vérité revenus : total_price × (1 - owner_commission_pct/100)
  par booking, où owner_commission_pct vient de la listing concernée
  (default 8 si NULL). Statuts comptés : active, in_progress,
  pending_return, pending_owner_validation, completed, disputed —
  les terminaux non-payés (cancelled/refused/expired) sont exclus.

  Funnel :
  - vues + sauvegardes : compteurs all-time sur les listings du pro
  - demandes : count conversations ce mois
  - locations : count bookings >= active ce mois
*/

CREATE OR REPLACE FUNCTION public.get_pro_stats_summary()
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller_id   uuid := auth.uid();
  v_caller      record;
  v_month_start timestamptz := date_trunc('month', now());
  v_six_months  timestamptz := date_trunc('month', now()) - interval '5 months';
  v_active_status text[] := ARRAY[
    'active','in_progress','pending_return','pending_owner_validation','completed','disputed'
  ];
  v_result jsonb;
BEGIN
  IF v_caller_id IS NULL THEN
    RETURN jsonb_build_object('error', 'Non authentifié');
  END IF;

  SELECT id, is_pro, rating_avg, rating_count,
         stripe_charges_enabled, stripe_payouts_enabled, stripe_details_submitted
  INTO v_caller
  FROM public.profiles
  WHERE id = v_caller_id;

  IF NOT FOUND OR v_caller.is_pro IS NOT TRUE THEN
    RETURN jsonb_build_object('error', 'Réservé aux comptes pro');
  END IF;

  WITH paid_bookings AS (
    SELECT
      b.id,
      b.created_at,
      b.total_price::numeric                                                  AS gross,
      b.total_price::numeric * (1 - COALESCE(l.owner_commission_percent, 8) / 100.0) AS net_pro,
      b.total_price::numeric *      COALESCE(l.owner_commission_percent, 8) / 100.0  AS commission,
      l.id   AS listing_id,
      l.name AS listing_name,
      l.photos_url
    FROM public.bookings b
    JOIN public.listings l ON l.id = b.listing_id
    WHERE b.owner_id = v_caller_id
      AND b.status = ANY (v_active_status)
  ),
  this_month_bookings AS (
    SELECT * FROM paid_bookings WHERE created_at >= v_month_start
  ),
  monthly_buckets AS (
    SELECT
      to_char(date_trunc('month', created_at), 'YYYY-MM') AS month_key,
      count(*) AS bookings_count,
      COALESCE(sum(net_pro), 0) AS revenue_net
    FROM paid_bookings
    WHERE created_at >= v_six_months
    GROUP BY 1
  ),
  monthly_filled AS (
    SELECT
      to_char(m, 'YYYY-MM') AS month_key,
      COALESCE(b.bookings_count, 0) AS bookings_count,
      COALESCE(b.revenue_net, 0)    AS revenue_net
    FROM generate_series(v_six_months, v_month_start, '1 month'::interval) m
    LEFT JOIN monthly_buckets b ON b.month_key = to_char(m, 'YYYY-MM')
    ORDER BY m
  ),
  top_listings AS (
    SELECT
      listing_id,
      listing_name,
      photos_url,
      count(*) AS bookings_count,
      sum(net_pro) AS revenue_net
    FROM paid_bookings
    GROUP BY listing_id, listing_name, photos_url
    ORDER BY revenue_net DESC NULLS LAST
    LIMIT 5
  ),
  funnel AS (
    SELECT
      COALESCE(sum(views_count), 0)::int AS views_total,
      COALESCE(sum(saves_count), 0)::int AS saves_total
    FROM public.listings
    WHERE owner_id = v_caller_id
  ),
  funnel_requests AS (
    SELECT count(*)::int AS requests_this_month
    FROM public.conversations
    WHERE owner_id = v_caller_id
      AND created_at >= v_month_start
  ),
  funnel_bookings AS (
    SELECT count(*)::int AS bookings_this_month
    FROM this_month_bookings
  ),
  open_disputes AS (
    SELECT count(*)::int AS n
    FROM public.disputes d
    JOIN public.bookings b ON b.id = d.booking_id
    WHERE b.owner_id = v_caller_id
      AND d.status = 'open'
  ),
  recent_reviews AS (
    SELECT jsonb_agg(row ORDER BY (row->>'created_at') DESC) AS arr
    FROM (
      SELECT jsonb_build_object(
        'rating', r.rating,
        'comment', r.comment,
        'reviewer_username', p.username,
        'reviewer_photo_url', p.photo_url,
        'listing_name', l.name,
        'created_at', r.created_at
      ) AS row
      FROM public.reviews r
      JOIN public.profiles p ON p.id = r.reviewer_id
      JOIN public.listings l ON l.id = r.listing_id
      WHERE r.reviewed_id = v_caller_id
      ORDER BY r.created_at DESC
      LIMIT 3
    ) sub
  )
  SELECT jsonb_build_object(
    'kpis', jsonb_build_object(
      'revenue_this_month_net', COALESCE((SELECT sum(net_pro) FROM this_month_bookings), 0),
      'bookings_this_month',    COALESCE((SELECT count(*)    FROM this_month_bookings), 0),
      'rating_avg',             v_caller.rating_avg,
      'rating_count',           v_caller.rating_count,
      'open_disputes',          (SELECT n FROM open_disputes)
    ),
    'revenue', jsonb_build_object(
      'all_time_gross',      COALESCE((SELECT sum(gross)      FROM paid_bookings), 0),
      'all_time_commission', COALESCE((SELECT sum(commission) FROM paid_bookings), 0),
      'all_time_net',        COALESCE((SELECT sum(net_pro)    FROM paid_bookings), 0),
      'this_month_gross',      COALESCE((SELECT sum(gross)      FROM this_month_bookings), 0),
      'this_month_commission', COALESCE((SELECT sum(commission) FROM this_month_bookings), 0),
      'this_month_net',        COALESCE((SELECT sum(net_pro)    FROM this_month_bookings), 0),
      'all_time_bookings_count', COALESCE((SELECT count(*) FROM paid_bookings), 0)
    ),
    'monthly_stats', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'month',    month_key,
        'bookings', bookings_count,
        'revenue',  revenue_net
      ))
      FROM monthly_filled),
      '[]'::jsonb
    ),
    'funnel_this_month', jsonb_build_object(
      'views',    (SELECT views_total FROM funnel),
      'saves',    (SELECT saves_total FROM funnel),
      'requests', (SELECT requests_this_month FROM funnel_requests),
      'bookings', (SELECT bookings_this_month FROM funnel_bookings)
    ),
    'top_listings', COALESCE(
      (SELECT jsonb_agg(jsonb_build_object(
        'id',       listing_id,
        'name',     listing_name,
        'photo',    (photos_url->>0),
        'bookings', bookings_count,
        'revenue',  revenue_net
      ))
      FROM top_listings),
      '[]'::jsonb
    ),
    'recent_reviews', COALESCE((SELECT arr FROM recent_reviews), '[]'::jsonb),
    'stripe', jsonb_build_object(
      'charges_enabled',    v_caller.stripe_charges_enabled,
      'payouts_enabled',    v_caller.stripe_payouts_enabled,
      'details_submitted',  v_caller.stripe_details_submitted,
      'payouts_delay_days', 14
    ),
    'computed_at', now()
  ) INTO v_result;

  RETURN v_result;
END;
$function$;

GRANT EXECUTE ON FUNCTION public.get_pro_stats_summary() TO authenticated;
