/*
  # Revoke profiles.location_data from authenticated SELECT

  Background
  ----------
  Migration 20260426202603 granted SELECT on `location_data` to the
  `authenticated` role at the column level so that the listing screen
  could read the owner's lat/lng for the pickup map. The 2026-04-28
  third-party audit flagged this as RGPD/data-minimisation breach: any
  authenticated user can SELECT every other user's `location_data`,
  exposing personal home addresses far beyond what's needed.

  The exact GPS path for legitimate consumers (owner / admin / renter
  with active booking) already runs through the
  `get_listing_exact_location(p_listing_id uuid)` SECURITY DEFINER RPC.
  Anonymous browsing uses `listings.approx_latitude/approx_longitude`
  (the ~330 m blurred coords). Owner-self-read goes through
  `get_my_profile()` (also SECURITY DEFINER).

  Fix
  ---
  Drop SELECT on the `location_data` column for `authenticated`. The
  rest of the existing GRANT (business_address, siren_number,
  business_lat/lng, etc.) is preserved — those are pro business info
  intentionally surfaced on public listings and not the audit's target.

  Frontend (already updated, same commit):
   - All `owner:profiles!fkey(... location_data)` joins were stripped
   - Direct own-profile SELECTs that fetched `location_data` were
     migrated to `supabase.rpc('get_my_profile')`
   - Chat/reservations city labels that came from `owner.location_data`
     were dropped (the listing's exact address only appears post-booking
     via get_listing_exact_location anyway)
*/

REVOKE SELECT (location_data) ON public.profiles FROM authenticated;
