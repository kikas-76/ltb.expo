/*
  # Blur listing GPS for authenticated users — phase 1 (additive)

  Background
  ----------
  After closing the anonymous-read leak on listings.latitude / longitude /
  location_data (migration 20260427150000), the same data was still exposed
  to every authenticated user — i.e. the renter was given the owner's exact
  home GPS even before booking. This is more than necessary: the only flows
  that need the exact pin are:
    - the owner editing/viewing their own listing (and the map preview);
    - a renter who has a booking in `accepted` or beyond, who needs the
      pickup address.

  Approach
  --------
  Two-step rollout to avoid breaking the live web/native app while it still
  selects `latitude, longitude, location_data` directly.

  Phase 1 (this migration, additive only):
    1. Add `approx_latitude` / `approx_longitude` to public.listings,
       populated by a deterministic per-listing jitter (~330 m radius).
    2. Add a BEFORE INSERT/UPDATE trigger that keeps them in sync.
    3. Backfill existing rows.
    4. GRANT SELECT on the two new columns to anon (and authenticated
       already has full SELECT, no change needed).
    5. Add a SECURITY DEFINER RPC `get_listing_exact_location(listing_id)`
       that reveals the exact GPS / location_data only to:
         - the listing owner;
         - admins;
         - a renter with a booking on that listing in a status >= accepted.

  Phase 2 (separate migration, run AFTER the web/native app is shipped
  using the new approx_* columns and the RPC):
    - REVOKE SELECT (latitude, longitude, location_data) from authenticated.

  Why deterministic jitter (not random per render)
  ------------------------------------------------
  If the offset were re-randomised every read, the pin would jump on each
  page load and refresh, which feels broken to users and lets an attacker
  triangulate the true location by averaging many reads. Seeding the offset
  on the listing UUID gives every listing a stable fake pin while still
  hiding the exact home, and two listings posted at the same physical
  address get different jitters (no clustering reveal).

  Rationale: ±0.003° ≈ 330 m at FR latitudes. Enough to obscure a building
  without making the city-level map useless.
*/

-- 1. Deterministic jitter helper
CREATE OR REPLACE FUNCTION public.compute_approx_coord(
  exact_value double precision,
  seed_uuid uuid,
  axis text
) RETURNS double precision
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  -- hashtext returns int4 in [-2^31, 2^31). Map to [-1, 1) then scale by
  -- 0.003 degrees (~330 m). Reproducibility is intentional, see header.
  SELECT exact_value
       + ((hashtext(seed_uuid::text || axis)::numeric / 2147483648.0) * 0.003)::double precision;
$$;

REVOKE ALL ON FUNCTION public.compute_approx_coord(double precision, uuid, text) FROM PUBLIC;

-- 2. Add columns
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS approx_latitude  double precision,
  ADD COLUMN IF NOT EXISTS approx_longitude double precision;

-- 3. Trigger
CREATE OR REPLACE FUNCTION public.tg_listings_compute_approx_coords()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.latitude IS NOT NULL AND NEW.longitude IS NOT NULL THEN
    NEW.approx_latitude  := public.compute_approx_coord(NEW.latitude,  NEW.id, 'lat');
    NEW.approx_longitude := public.compute_approx_coord(NEW.longitude, NEW.id, 'lng');
  ELSE
    NEW.approx_latitude  := NULL;
    NEW.approx_longitude := NULL;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listings_compute_approx_coords ON public.listings;
CREATE TRIGGER listings_compute_approx_coords
  BEFORE INSERT OR UPDATE OF latitude, longitude
  ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.tg_listings_compute_approx_coords();

-- 4. Backfill
UPDATE public.listings
SET
  approx_latitude  = public.compute_approx_coord(latitude,  id, 'lat'),
  approx_longitude = public.compute_approx_coord(longitude, id, 'lng')
WHERE latitude IS NOT NULL AND longitude IS NOT NULL;

-- 5. Anon GRANT for the two new columns. authenticated keeps full SELECT
--    until the phase-2 revoke migration is applied.
GRANT SELECT (approx_latitude, approx_longitude)
  ON public.listings TO anon;

-- 6. Exact-location RPC
CREATE OR REPLACE FUNCTION public.get_listing_exact_location(p_listing_id uuid)
RETURNS TABLE(
  id uuid,
  latitude double precision,
  longitude double precision,
  location_data jsonb
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public, pg_temp
AS $$
  SELECT l.id, l.latitude, l.longitude, l.location_data
  FROM public.listings l
  WHERE l.id = p_listing_id
    AND (
      l.owner_id = auth.uid()
      OR ((auth.jwt() -> 'app_metadata' ->> 'role') = 'admin')
      OR EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.listing_id = l.id
          AND b.renter_id  = auth.uid()
          AND b.status IN (
            'accepted',
            'pending_payment',
            'active',
            'in_progress',
            'pending_return',
            'pending_owner_validation',
            'completed',
            'disputed'
          )
      )
    );
$$;

REVOKE ALL ON FUNCTION public.get_listing_exact_location(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_listing_exact_location(uuid) TO authenticated;

COMMENT ON FUNCTION public.get_listing_exact_location(uuid) IS
  'Returns latitude, longitude and location_data for a listing only if the caller is the owner, an admin, or a renter with a booking in a status >= accepted. Used by app screens that need the exact pin (listing detail map for the owner, booking detail for the renter).';
