/*
  # SECURITY DEFINER RPC to check an owner's Stripe-ready status

  Background
  ----------
  Two client paths need to know whether a listing owner is set up to
  receive payments before showing a "Pay" button or routing the renter
  to checkout:
   - app/chat/[id].tsx — renter on an accepted conversation
   - app/(tabs)/reservations.tsx — list of the renter's accepted convs

  Both did
    supabase.from('profiles').select('stripe_onboarding_complete, stripe_charges_enabled')
  but those columns were dropped from the authenticated grant by
  20260426202603_tighten_profiles_visibility.sql. The reads silently
  401, the renter sees the Pay button gated to false, and effectively
  can't pay.

  Fix
  ---
  A small SECURITY DEFINER RPC that returns a single boolean for the
  caller's counterparty. Auth is scoped: the caller must already be a
  participant of a conversation (as requester) or booking (as renter)
  with the queried owner. That mirrors who could already SEE the owner
  via existing RLS, so this RPC adds no new disclosure.

  We return ONE pre-computed `stripe_ready` (charges_enabled AND
  onboarding_complete) instead of leaking the two raw flags — the
  Stripe state machine has more states than this product distinguishes
  and we don't want to commit to exposing them.
*/

CREATE OR REPLACE FUNCTION public.get_owner_stripe_ready(p_owner_id uuid)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_ready boolean;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_owner_id IS NULL THEN
    RETURN false;
  END IF;

  -- Counterparty check: an existing conversation as requester OR an
  -- existing booking as renter where the queried profile is the owner.
  IF NOT EXISTS (
    SELECT 1
      FROM public.conversations c
     WHERE c.owner_id = p_owner_id
       AND c.requester_id = v_caller
  ) AND NOT EXISTS (
    SELECT 1
      FROM public.bookings b
     WHERE b.owner_id = p_owner_id
       AND b.renter_id = v_caller
  ) THEN
    RAISE EXCEPTION 'Not a counterparty of this owner' USING ERRCODE = '42501';
  END IF;

  SELECT (
    COALESCE(p.stripe_charges_enabled, false)
    AND COALESCE(p.stripe_onboarding_complete, false)
  )
    INTO v_ready
    FROM public.profiles p
   WHERE p.id = p_owner_id;

  RETURN COALESCE(v_ready, false);
END;
$$;

REVOKE ALL ON FUNCTION public.get_owner_stripe_ready(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_owner_stripe_ready(uuid) TO authenticated;
