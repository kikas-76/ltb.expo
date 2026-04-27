/*
  # Admin RPC: full user-details bundle

  Background
  ----------
  /admin/user/[id] selected profiles directly with the sensitive columns
  (email, role, account_status, ban_*, stripe_*, phone_number, ...). Those
  columns no longer have SELECT for the authenticated role (column-level
  hardening), so the page silently rendered "Utilisateur introuvable"
  (the JOINs against bookings/listings/etc. still worked but profile=null
  short-circuited the screen).

  This RPC consolidates everything the admin needs into one round-trip:
    - profile (all columns, including the restricted ones)
    - account_events
    - bookings (as renter and as owner)
    - listings owned
    - disputes filed
    - reports filed
    - favorites (saved listings)
    - conversations (active discussions)

  SECURITY DEFINER bypasses both the column grants and any RLS that would
  prevent an admin from reading another user's conversations / favorites.
  Access is gated on profiles.role = 'admin'; the protect_role_column
  trigger keeps non-admins from self-promoting.
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
    'listing_name', l.name, 'is_active', l.is_active,
    'owner_username', op.username
  ) ORDER BY s.saved_at DESC), '[]'::jsonb)
  INTO v_favorites
  FROM (
    SELECT * FROM public.saved_listings WHERE user_id = p_user_id
    ORDER BY saved_at DESC LIMIT 50
  ) s
  LEFT JOIN public.listings l ON l.id = s.listing_id
  LEFT JOIN public.profiles op ON op.id = l.owner_id;

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id, 'status', c.status, 'created_at', c.created_at,
    'start_date', c.start_date, 'end_date', c.end_date,
    'listing_name', l.name, 'is_requester', c.requester_id = p_user_id,
    'other_username', CASE WHEN c.requester_id = p_user_id THEN op.username ELSE rp.username END,
    'last_message_at', (
      SELECT MAX(cm.created_at) FROM public.chat_messages cm
      WHERE cm.conversation_id = c.id
    )
  ) ORDER BY c.created_at DESC), '[]'::jsonb)
  INTO v_conversations
  FROM (
    SELECT * FROM public.conversations
    WHERE requester_id = p_user_id OR owner_id = p_user_id
    ORDER BY created_at DESC LIMIT 30
  ) c
  LEFT JOIN public.listings l ON l.id = c.listing_id
  LEFT JOIN public.profiles op ON op.id = c.owner_id
  LEFT JOIN public.profiles rp ON rp.id = c.requester_id;

  RETURN jsonb_build_object(
    'profile', v_profile,
    'events', v_events,
    'bookings_as_renter', v_bookings_renter,
    'bookings_as_owner', v_bookings_owner,
    'listings', v_listings,
    'disputes_filed', v_disputes,
    'reports_filed', v_reports,
    'favorites', v_favorites,
    'conversations', v_conversations
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_user_details(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_user_details(uuid) TO authenticated;
