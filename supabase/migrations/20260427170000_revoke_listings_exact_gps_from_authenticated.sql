/*
  # Phase 2: revoke exact GPS / location_data from authenticated callers

  ⚠ DEPLOY AFTER the web/native app is shipped with the column-name
  rename and the get_listing_exact_location RPC integration. Until
  then, applying this migration will break every authenticated call
  that still selects `latitude, longitude, location_data` directly.

  Pre-flight checklist
  --------------------
  1. Web is deployed with the build that uses approx_latitude /
     approx_longitude in every listings select, and `app/listing/[id]`
     calls the get_listing_exact_location RPC for the exact pin.
  2. iOS / Android binaries are rebuilt and shipped (or at least the
     OTA update is rolled out).
  3. `npm run typecheck` clean and `vitest` green on the branch.

  After this migration:
  - Anon: still sees only the safe column subset (set up in
    20260427150000_tighten_listings_visibility.sql) plus the new
    approx_* columns. Sensitive columns remain hidden.
  - Authenticated: same story — sensitive columns are revoked.
    Owners (and admins, and renters with a booking >= accepted)
    fetch the exact GPS / address through
    `public.get_listing_exact_location(listing_id uuid)` instead.
*/

REVOKE SELECT (latitude, longitude, location_data)
  ON public.listings
  FROM authenticated;

-- Defense in depth: anon never had these granted in 20260427150000;
-- assert it again so both roles end up with the same shape.
REVOKE SELECT (latitude, longitude, location_data)
  ON public.listings
  FROM anon;
