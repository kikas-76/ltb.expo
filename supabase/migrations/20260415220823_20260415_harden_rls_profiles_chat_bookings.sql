/*
  # Hardening RLS — 3 critical security fixes

  ## Summary
  This migration addresses 3 remaining critical RLS vulnerabilities identified in audit:

  ## Fix 1: profiles — Replace USING(true) SELECT with owner+admin only
  Problem: "Authenticated can read public profile fields" used USING(true), exposing
  ALL columns (location_data, account_status, ban_reason, banned_until, banned_by,
  stripe_customer_id, phone_number) to ANY authenticated user.
  Solution:
  - Drop the broad USING(true) policy
  - Keep "Admin full read profiles" (admin OR owner sees own full profile)
  - Create a secure VIEW "public_profiles" exposing only safe public fields
    with SECURITY INVOKER (no privilege escalation)
  - Grant SELECT on the view to authenticated and anon roles

  Public fields exposed via view: id, username, avatar_url, photo_url, bio, is_pro,
  business_name, business_address, business_type, business_hours, siren_number,
  location_data (needed for map display), created_at
  NOT exposed publicly: stripe_customer_id, phone_number, account_status,
  ban_reason, banned_until, banned_by, address (private home address)

  ## Fix 2: chat_messages — Remove "System chat messages by participants" policy
  Problem: Any authenticated participant could insert is_system=true, sender_id=NULL
  messages, forging system notifications (booking accepted, dispute opened, etc.)
  Solution:
  - Drop "System chat messages by participants" INSERT policy
  - System messages are now ONLY insertable via service_role (Edge Functions)
  - Normal user message INSERT policy ("Participants can send chat messages") preserved

  ## Fix 3: bookings — Replace broad UPDATE with SECURITY DEFINER function
  Problem: Both UPDATE policies allowed renter/owner to update ANY column on the row,
  including stripe_checkout_session_id, deposit_amount, owner_id, renter_id, etc.
  Solution:
  - Drop "Owner or renter can update booking status" (broad, no column restriction)
  - Keep "Admin update bookings" for admin operations
  - Create SECURITY DEFINER function update_booking_status() that enforces:
    * Only status column (and specific allowed fields per transition)
    * Valid status transition matrix based on caller role
    * Caller must be renter_id or owner_id of the booking
  - Grant EXECUTE on function to authenticated role

  ## Allowed Status Transitions (enforced in function)
  Owner (owner_id):
    pending → accepted | refused
    pending_payment → accepted | refused
    in_progress → pending_owner_validation (via return confirm, handled by function)
    pending_owner_validation → completed | disputed
  Renter (renter_id):
    accepted → pending_payment (proceed to pay)
    in_progress → pending_owner_validation (via return confirm)
  Both:
    handover/return confirmation fields (owner_handover_confirmed, renter_handover_confirmed,
    owner_return_confirmed, renter_return_confirmed, return_confirmed_at, owner_validated)

  ## Tables / Objects Modified
  - profiles: DROP 1 policy, no data change
  - chat_messages: DROP 1 policy, no data change
  - bookings: DROP 1 policy, CREATE 1 function, no data change
  - New VIEW: public_profiles (safe public read)

  ## Important Notes
  1. Application code querying profiles for public display must use the
     public_profiles view instead of the profiles table directly
  2. System message inserts in client code must be routed through the
     post-system-message Edge Function (uses service_role)
  3. Direct booking status updates from client must call the
     update_booking_status() RPC function instead of .update()
*/

-- ============================================================
-- FIX 1: profiles — drop broad SELECT, create public view
-- ============================================================

DROP POLICY IF EXISTS "Authenticated can read public profile fields" ON public.profiles;

-- The remaining "Admin full read profiles" policy covers:
--   admin → full read of all profiles
--   owner → full read of own profile
-- That is correct and sufficient for the profiles table itself.

-- Create a secure view for public profile data
CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = true)
AS
  SELECT
    id,
    username,
    avatar_url,
    photo_url,
    bio,
    is_pro,
    business_name,
    business_address,
    business_type,
    business_hours,
    siren_number,
    location_data,
    created_at
  FROM public.profiles;

-- Grant read access to authenticated users and anon
GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;

-- ============================================================
-- FIX 2: chat_messages — remove forgeable system message policy
-- ============================================================

DROP POLICY IF EXISTS "System chat messages by participants" ON public.chat_messages;

-- "Participants can send chat messages" remains — it already enforces
-- sender_id = auth.uid(), so is_system=true with sender_id=NULL is
-- now impossible for any client user.
-- System messages are exclusively inserted by Edge Functions via service_role.

-- ============================================================
-- FIX 3: bookings — replace broad UPDATE with validated RPC
-- ============================================================

DROP POLICY IF EXISTS "Owner or renter can update booking status" ON public.bookings;

-- Create SECURITY DEFINER function for validated booking status transitions
-- Only this function (running as postgres superuser) can write booking updates
-- on behalf of renter/owner. Client calls supabase.rpc('update_booking_status', ...)
CREATE OR REPLACE FUNCTION public.update_booking_status(
  p_booking_id uuid,
  p_new_status text,
  p_extra jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_catalog
AS $$
DECLARE
  v_booking bookings%ROWTYPE;
  v_caller uuid;
  v_is_owner boolean;
  v_is_renter boolean;
  v_allowed_transitions jsonb;
  v_allowed_statuses text[];
  v_update_fields jsonb;
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

  -- Transition matrix
  -- Owner transitions
  IF v_is_owner THEN
    CASE v_booking.status
      WHEN 'pending' THEN
        v_allowed_statuses := ARRAY['accepted','refused'];
      WHEN 'pending_payment' THEN
        v_allowed_statuses := ARRAY['accepted','refused'];
      WHEN 'pending_owner_validation' THEN
        v_allowed_statuses := ARRAY['completed','disputed'];
      WHEN 'in_progress' THEN
        v_allowed_statuses := ARRAY['pending_owner_validation','disputed'];
      ELSE
        v_allowed_statuses := ARRAY[]::text[];
    END CASE;
  END IF;

  -- Renter transitions (may override some if also owner for edge case)
  IF v_is_renter AND NOT v_is_owner THEN
    CASE v_booking.status
      WHEN 'accepted' THEN
        v_allowed_statuses := ARRAY['pending_payment'];
      WHEN 'in_progress' THEN
        v_allowed_statuses := ARRAY['pending_owner_validation'];
      WHEN 'pending_owner_validation' THEN
        v_allowed_statuses := ARRAY['disputed'];
      ELSE
        v_allowed_statuses := ARRAY[]::text[];
    END CASE;
  END IF;

  -- Special: handover / return confirmation fields (no status change)
  IF p_new_status = v_booking.status AND p_extra != '{}'::jsonb THEN
    -- Allow updating handover/return confirmation fields only
    DECLARE
      v_allowed_extra_keys text[] := ARRAY[
        'owner_handover_confirmed','renter_handover_confirmed',
        'owner_return_confirmed','renter_return_confirmed',
        'return_confirmed_at','owner_validated'
      ];
      v_key text;
    BEGIN
      FOREACH v_key IN ARRAY (SELECT array_agg(k) FROM jsonb_object_keys(p_extra) AS k)
      LOOP
        IF NOT (v_key = ANY(v_allowed_extra_keys)) THEN
          RETURN jsonb_build_object('error', 'Field not allowed: ' || v_key);
        END IF;
      END LOOP;
    END;

    UPDATE public.bookings
    SET
      owner_handover_confirmed  = COALESCE((p_extra->>'owner_handover_confirmed')::boolean,  owner_handover_confirmed),
      renter_handover_confirmed = COALESCE((p_extra->>'renter_handover_confirmed')::boolean, renter_handover_confirmed),
      owner_return_confirmed    = COALESCE((p_extra->>'owner_return_confirmed')::boolean,    owner_return_confirmed),
      renter_return_confirmed   = COALESCE((p_extra->>'renter_return_confirmed')::boolean,   renter_return_confirmed),
      return_confirmed_at       = COALESCE((p_extra->>'return_confirmed_at')::timestamptz,   return_confirmed_at),
      owner_validated           = COALESCE((p_extra->>'owner_validated')::boolean,           owner_validated)
    WHERE id = p_booking_id;

    RETURN jsonb_build_object('success', true);
  END IF;

  -- Validate status transition
  IF NOT (p_new_status = ANY(v_allowed_statuses)) THEN
    RETURN jsonb_build_object(
      'error', 'Transition not allowed: ' || v_booking.status || ' → ' || p_new_status
    );
  END IF;

  -- Apply status update (with optional extra fields for combined transitions)
  UPDATE public.bookings
  SET
    status                    = p_new_status,
    owner_handover_confirmed  = COALESCE((p_extra->>'owner_handover_confirmed')::boolean,  owner_handover_confirmed),
    renter_handover_confirmed = COALESCE((p_extra->>'renter_handover_confirmed')::boolean, renter_handover_confirmed),
    owner_return_confirmed    = COALESCE((p_extra->>'owner_return_confirmed')::boolean,    owner_return_confirmed),
    renter_return_confirmed   = COALESCE((p_extra->>'renter_return_confirmed')::boolean,   renter_return_confirmed),
    return_confirmed_at       = COALESCE((p_extra->>'return_confirmed_at')::timestamptz,   return_confirmed_at),
    owner_validated           = COALESCE((p_extra->>'owner_validated')::boolean,           owner_validated)
  WHERE id = p_booking_id;

  RETURN jsonb_build_object('success', true, 'new_status', p_new_status);
END;
$$;

GRANT EXECUTE ON FUNCTION public.update_booking_status(uuid, text, jsonb) TO authenticated;
