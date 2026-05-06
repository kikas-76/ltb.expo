/*
  # Extend get_nearby_listings to embed owner + rating columns

  Before this change, the home page (`app/(tabs)/index.tsx`) called
  the RPC, then issued a follow-up SELECT keyed on the returned ids
  to hydrate owner info on each row. That second round-trip added
  ~150-300ms on every home load when the user has location set.

  The RPC now joins profiles directly and returns owner_id /
  owner_username / owner_photo_url / owner_is_pro plus the listing's
  cached rating_avg / rating_count, so the client renders the section
  with one round-trip.

  Same shape as before for distance_km and the existing columns —
  just additive. Callers who don't read the new fields keep working.
*/

DROP FUNCTION IF EXISTS public.get_nearby_listings(double precision, double precision, double precision, integer, integer);

CREATE OR REPLACE FUNCTION public.get_nearby_listings(
  user_lat double precision,
  user_lng double precision,
  radius_km double precision DEFAULT 50,
  lim integer DEFAULT 40,
  offset_val integer DEFAULT 0
)
RETURNS TABLE(
  id uuid,
  name text,
  price numeric,
  photos_url text[],
  category_name text,
  category_id uuid,
  approx_latitude double precision,
  approx_longitude double precision,
  owner_type text,
  rating_avg numeric,
  rating_count integer,
  owner_id uuid,
  owner_username text,
  owner_photo_url text,
  owner_is_pro boolean,
  distance_km double precision
)
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
SELECT
  l.id,
  l.name,
  l.price,
  l.photos_url,
  l.category_name,
  l.category_id,
  l.approx_latitude,
  l.approx_longitude,
  l.owner_type,
  l.rating_avg,
  l.rating_count,
  p.id          AS owner_id,
  p.username    AS owner_username,
  p.photo_url   AS owner_photo_url,
  p.is_pro      AS owner_is_pro,
  (
    6371.0 * 2.0 * ATAN2(
      SQRT(
        SIN(RADIANS((l.approx_latitude - user_lat) / 2.0)) ^ 2
        + COS(RADIANS(user_lat)) * COS(RADIANS(l.approx_latitude))
        * SIN(RADIANS((l.approx_longitude - user_lng) / 2.0)) ^ 2
      ),
      SQRT(
        1.0 - (
          SIN(RADIANS((l.approx_latitude - user_lat) / 2.0)) ^ 2
          + COS(RADIANS(user_lat)) * COS(RADIANS(l.approx_latitude))
          * SIN(RADIANS((l.approx_longitude - user_lng) / 2.0)) ^ 2
        )
      )
    )
  ) AS distance_km
FROM listings l
LEFT JOIN profiles p ON p.id = l.owner_id
WHERE
  l.is_active = true
  AND l.approx_latitude  IS NOT NULL
  AND l.approx_longitude IS NOT NULL
  AND (
    6371.0 * 2.0 * ATAN2(
      SQRT(
        SIN(RADIANS((l.approx_latitude - user_lat) / 2.0)) ^ 2
        + COS(RADIANS(user_lat)) * COS(RADIANS(l.approx_latitude))
        * SIN(RADIANS((l.approx_longitude - user_lng) / 2.0)) ^ 2
      ),
      SQRT(
        1.0 - (
          SIN(RADIANS((l.approx_latitude - user_lat) / 2.0)) ^ 2
          + COS(RADIANS(user_lat)) * COS(RADIANS(l.approx_latitude))
          * SIN(RADIANS((l.approx_longitude - user_lng) / 2.0)) ^ 2
        )
      )
    )
  ) <= radius_km
ORDER BY distance_km ASC
LIMIT lim
OFFSET offset_val;
$function$;
