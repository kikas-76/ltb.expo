/*
  # Surface the new Stripe Connect fields to admins

  20260430010000 added `stripe_details_submitted` and
  `stripe_requirements` on profiles. The admin RPCs predate that, so
  the moderation views still see the old binary "Stripe ✓ / ✗" picture.

  - admin_get_user_details: include the two new fields in the profile
    blob so the user-detail screen can render the same five states the
    renter sees in their wallet.
  - admin_list_users: include `stripe_details_submitted` in each row
    and replace the legacy validated / unvalidated stripe filter with
    granular values keyed on the derived state — `active`,
    `pending_review`, `action_required`, `onboarding`, `not_started`.
    `validated` / `unvalidated` are accepted as aliases of `active` /
    not-`active` so older clients don't break during rollout.
*/

CREATE OR REPLACE FUNCTION public.admin_get_user_details(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role text;
  v_profile jsonb;
  v_events jsonb;
  v_bookings_renter jsonb;
  v_bookings_owner jsonb;
  v_listings jsonb;
  v_disputes jsonb;
  v_reports jsonb;
  v_favorites jsonb;
  v_conversations jsonb;
BEGIN
  SELECT p.role INTO v_caller_role FROM public.profiles p WHERE p.id = auth.uid();
  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;

  SELECT jsonb_build_object(
    'id', p.id, 'username', p.username, 'display_name', p.display_name,
    'email', p.email, 'phone_number', p.phone_number, 'role', p.role,
    'is_pro', p.is_pro, 'created_at', p.created_at, 'bio', p.bio,
    'business_name', p.business_name, 'siren_number', p.siren_number,
    'stripe_account_id', p.stripe_account_id,
    'stripe_charges_enabled', p.stripe_charges_enabled,
    'stripe_payouts_enabled', p.stripe_payouts_enabled,
    'stripe_details_submitted', p.stripe_details_submitted,
    'stripe_requirements', p.stripe_requirements,
    'account_status', p.account_status, 'ban_reason', p.ban_reason,
    'banned_until', p.banned_until, 'location_data', p.location_data,
    'photo_url', p.photo_url, 'avatar_url', p.avatar_url
  ) INTO v_profile
  FROM public.profiles p WHERE p.id = p_user_id;

  IF v_profile IS NULL THEN
    RETURN jsonb_build_object('profile', NULL);
  END IF;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', e.id, 'event_type', e.event_type, 'reason', e.reason,
    'duration_days', e.duration_days, 'expires_at', e.expires_at,
    'created_at', e.created_at, 'performed_by_username', pp.username
  ) ORDER BY e.created_at DESC), '[]'::jsonb)
  INTO v_events
  FROM (
    SELECT * FROM public.user_account_events
    WHERE user_id = p_user_id ORDER BY created_at DESC LIMIT 30
  ) e
  LEFT JOIN public.profiles pp ON pp.id = e.performed_by;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', b.id, 'status', b.status, 'total_price', b.total_price,
    'start_date', b.start_date, 'end_date', b.end_date,
    'listing_name', l.name, 'other_username', op.username
  ) ORDER BY b.created_at DESC), '[]'::jsonb)
  INTO v_bookings_renter
  FROM (
    SELECT * FROM public.bookings WHERE renter_id = p_user_id
    ORDER BY created_at DESC LIMIT 30
  ) b
  LEFT JOIN public.listings l ON l.id = b.listing_id
  LEFT JOIN public.profiles op ON op.id = b.owner_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', b.id, 'status', b.status, 'total_price', b.total_price,
    'start_date', b.start_date, 'end_date', b.end_date,
    'listing_name', l.name, 'other_username', rp.username
  ) ORDER BY b.created_at DESC), '[]'::jsonb)
  INTO v_bookings_owner
  FROM (
    SELECT * FROM public.bookings WHERE owner_id = p_user_id
    ORDER BY created_at DESC LIMIT 30
  ) b
  LEFT JOIN public.listings l ON l.id = b.listing_id
  LEFT JOIN public.profiles rp ON rp.id = b.renter_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', l.id, 'name', l.name, 'is_active', l.is_active,
    'price', l.price, 'created_at', l.created_at
  ) ORDER BY l.created_at DESC), '[]'::jsonb)
  INTO v_listings
  FROM (
    SELECT * FROM public.listings WHERE owner_id = p_user_id
    ORDER BY created_at DESC LIMIT 50
  ) l;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', d.id, 'status', d.status, 'description', d.description,
    'created_at', d.created_at, 'listing_name', l.name
  ) ORDER BY d.created_at DESC), '[]'::jsonb)
  INTO v_disputes
  FROM (
    SELECT * FROM public.disputes WHERE reporter_id = p_user_id
    ORDER BY created_at DESC LIMIT 30
  ) d
  LEFT JOIN public.bookings b ON b.id = d.booking_id
  LEFT JOIN public.listings l ON l.id = b.listing_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', r.id, 'status', r.status, 'category', r.category,
    'description', r.description, 'created_at', r.created_at,
    'target_type', r.target_type, 'target_id', r.target_id
  ) ORDER BY r.created_at DESC), '[]'::jsonb)
  INTO v_reports
  FROM (
    SELECT * FROM public.reports WHERE reporter_id = p_user_id
    ORDER BY created_at DESC LIMIT 30
  ) r;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'listing_id', s.listing_id, 'saved_at', s.saved_at,
    'listing_name', l.name
  ) ORDER BY s.saved_at DESC), '[]'::jsonb)
  INTO v_favorites
  FROM (
    SELECT * FROM public.saved_listings WHERE user_id = p_user_id
    ORDER BY saved_at DESC LIMIT 50
  ) s
  LEFT JOIN public.listings l ON l.id = s.listing_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id, 'status', c.status, 'created_at', c.created_at,
    'listing_name', l.name, 'other_username', other.username
  ) ORDER BY c.created_at DESC), '[]'::jsonb)
  INTO v_conversations
  FROM (
    SELECT * FROM public.conversations
    WHERE requester_id = p_user_id OR owner_id = p_user_id
    ORDER BY created_at DESC LIMIT 30
  ) c
  LEFT JOIN public.listings l ON l.id = c.listing_id
  LEFT JOIN public.profiles other ON other.id =
    CASE WHEN c.requester_id = p_user_id THEN c.owner_id ELSE c.requester_id END;

  RETURN jsonb_build_object(
    'profile', v_profile,
    'events', v_events,
    'bookings_as_renter', v_bookings_renter,
    'bookings_as_owner', v_bookings_owner,
    'listings', v_listings,
    'disputes', v_disputes,
    'reports', v_reports,
    'favorites', v_favorites,
    'conversations', v_conversations
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_user_details(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_user_details(uuid) TO authenticated;


CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_stripe_filter text DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_caller_role text;
  v_total bigint;
  v_rows jsonb;
  v_filter text;
BEGIN
  SELECT p.role INTO v_caller_role FROM public.profiles p WHERE p.id = auth.uid();
  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;

  -- Map legacy filter values to the new granular set so the older
  -- admin client (still shipping `validated` / `unvalidated`) keeps
  -- working until the next deploy.
  v_filter := CASE p_stripe_filter
    WHEN 'validated'   THEN 'active'
    WHEN 'unvalidated' THEN 'not_active'
    ELSE p_stripe_filter
  END;

  -- Helper predicate inlined twice (count + page query). Keeps both
  -- branches in lock-step so the count exactly matches the rows.

  SELECT COUNT(*)::bigint INTO v_total
  FROM public.profiles p
  WHERE (p_status IS NULL OR p.account_status = p_status)
    AND (
      v_filter IS NULL
      OR (v_filter = 'active'         AND p.stripe_charges_enabled IS TRUE
                                      AND COALESCE(p.stripe_payouts_enabled, false) IS TRUE
                                      AND (p.stripe_requirements->>'disabled_reason') IS NULL
                                      AND COALESCE(jsonb_array_length(p.stripe_requirements->'past_due'), 0) = 0)
      OR (v_filter = 'pending_review' AND COALESCE(p.stripe_details_submitted, false) IS TRUE
                                      AND (p.stripe_charges_enabled IS NOT TRUE OR COALESCE(p.stripe_payouts_enabled, false) IS NOT TRUE)
                                      AND (p.stripe_requirements->>'disabled_reason') IS NULL
                                      AND COALESCE(jsonb_array_length(p.stripe_requirements->'past_due'), 0) = 0)
      OR (v_filter = 'action_required' AND ((p.stripe_requirements->>'disabled_reason') IS NOT NULL
                                          OR COALESCE(jsonb_array_length(p.stripe_requirements->'past_due'), 0) > 0))
      OR (v_filter = 'onboarding'      AND p.stripe_account_id IS NOT NULL
                                       AND COALESCE(p.stripe_details_submitted, false) IS NOT TRUE)
      OR (v_filter = 'not_started'     AND p.stripe_account_id IS NULL)
      OR (v_filter = 'not_active'      AND COALESCE(p.stripe_charges_enabled, false) IS NOT TRUE)
    )
    AND (
      p_search IS NULL OR p_search = ''
      OR p.username ILIKE '%' || p_search || '%'
      OR p.email    ILIKE '%' || p_search || '%'
    );

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT p.id, p.username, p.email, p.is_pro, p.role,
           p.account_status,
           p.stripe_account_id,
           p.stripe_charges_enabled,
           p.stripe_payouts_enabled,
           p.stripe_details_submitted,
           p.stripe_requirements,
           p.created_at
    FROM public.profiles p
    WHERE (p_status IS NULL OR p.account_status = p_status)
      AND (
        v_filter IS NULL
        OR (v_filter = 'active'         AND p.stripe_charges_enabled IS TRUE
                                        AND COALESCE(p.stripe_payouts_enabled, false) IS TRUE
                                        AND (p.stripe_requirements->>'disabled_reason') IS NULL
                                        AND COALESCE(jsonb_array_length(p.stripe_requirements->'past_due'), 0) = 0)
        OR (v_filter = 'pending_review' AND COALESCE(p.stripe_details_submitted, false) IS TRUE
                                        AND (p.stripe_charges_enabled IS NOT TRUE OR COALESCE(p.stripe_payouts_enabled, false) IS NOT TRUE)
                                        AND (p.stripe_requirements->>'disabled_reason') IS NULL
                                        AND COALESCE(jsonb_array_length(p.stripe_requirements->'past_due'), 0) = 0)
        OR (v_filter = 'action_required' AND ((p.stripe_requirements->>'disabled_reason') IS NOT NULL
                                            OR COALESCE(jsonb_array_length(p.stripe_requirements->'past_due'), 0) > 0))
        OR (v_filter = 'onboarding'      AND p.stripe_account_id IS NOT NULL
                                         AND COALESCE(p.stripe_details_submitted, false) IS NOT TRUE)
        OR (v_filter = 'not_started'     AND p.stripe_account_id IS NULL)
        OR (v_filter = 'not_active'      AND COALESCE(p.stripe_charges_enabled, false) IS NOT TRUE)
      )
      AND (
        p_search IS NULL OR p_search = ''
        OR p.username ILIKE '%' || p_search || '%'
        OR p.email    ILIKE '%' || p_search || '%'
      )
    ORDER BY p.created_at DESC
    LIMIT GREATEST(p_limit, 0) OFFSET GREATEST(p_offset, 0)
  ) t;

  RETURN jsonb_build_object('rows', v_rows, 'total', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users(text, text, text, integer, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, text, text, integer, integer) TO authenticated;
