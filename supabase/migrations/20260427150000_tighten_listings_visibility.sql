/*
  # Tighten listings visibility — remove anon access to GPS / location_data

  Background
  ----------
  External responsible-disclosure report (2026-04-27) flagged that
  listings.latitude / listings.longitude / listings.location_data are
  readable by anonymous (un-authenticated) callers. Combined with the
  fact that those columns are populated from the owner's home GPS
  (see app/create-listing.tsx, which copies profile.location_data
  into listings.latitude/longitude on insert), this exposed the home
  coordinates of every active listing's owner to anyone holding the
  public anon key — i.e. anyone who loaded the web app.

  Live state (verified 2026-04-27 via Supabase MCP)
  -------------------------------------------------
  - Policy "Listings actifs publics anon" exists with TO {anon}
    USING (is_active = true). Wide-open SELECT for anonymous.
  - The `anon` role has INSERT / SELECT / UPDATE / REFERENCES privileges
    on EVERY column of public.listings, including latitude, longitude,
    location_data. RLS denies anon writes (no INSERT/UPDATE policy
    targets anon) so writes are blocked in practice, but the column
    privileges themselves are excess attack surface.

  Why the previous hardening missed this
  --------------------------------------
  - 20260411214148_fix_security_indexes_rls_policies.sql created a
    "Listings actifs publics" SELECT policy with no `TO` clause.
  - Subsequent migrations consolidated authenticated policies but
    left anon column privileges untouched.
  - 20260426202603_tighten_profiles_visibility.sql applied
    column-level GRANTs to `profiles` but the same treatment was
    never applied to `listings`.

  Approach
  --------
  1. Replace the anon SELECT policy with a clearly-named one that
     still allows browsing active listings.
  2. REVOKE every privilege on public.listings from anon, then
     GRANT SELECT only on the non-sensitive subset. Sensitive
     columns (latitude, longitude, location_data) are NOT granted,
     so any direct REST select asking for them via the anon key
     returns "permission denied for column".
  3. Authenticated keeps full access (still needed for the in-app
     map/distance features). Hiding the exact GPS from authenticated
     callers as well is a separate UX change tracked below.

  Out of scope (follow-up)
  ------------------------
  - Storing an offset/blurred lat/lng for map display (~200-500 m
    jitter) and only revealing the exact GPS to the renter once the
    booking is `accepted`/`active`.
  - Auditing listings.location_data content for any PII still
    embedded there.
  - Same review on `bookings` and other tables that may have
    inherited wide-open privileges.
*/

-- 1. Drop both legacy and current variants of the anon policy
DROP POLICY IF EXISTS "Listings actifs publics" ON public.listings;
DROP POLICY IF EXISTS "Listings actifs publics anon" ON public.listings;
DROP POLICY IF EXISTS "Anon can view active listings" ON public.listings;

-- 2. Recreate a single explicit anon SELECT policy
CREATE POLICY "Anon can view active listings"
  ON public.listings
  FOR SELECT
  TO anon
  USING (is_active = true);

-- 3. Reset anon privileges and grant only the safe columns.
--    REFERENCES / INSERT / UPDATE on anon are excess surface; RLS
--    blocks anon writes anyway, but removing the privilege makes the
--    posture explicit.
REVOKE ALL ON public.listings FROM anon;

GRANT SELECT (
  id,
  owner_id,
  name,
  description,
  price,
  deposit_amount,
  renter_fee_percent,
  owner_commission_percent,
  photos_url,
  category_id,
  category_name,
  subcategory_id,
  subcategory_name,
  owner_type,
  is_active,
  views_count,
  saves_count,
  created_at
) ON public.listings TO anon;

-- 4. Authenticated keeps full table access (existing
--    "Listings visible par authenticated" policy still applies).
GRANT SELECT ON public.listings TO authenticated;
