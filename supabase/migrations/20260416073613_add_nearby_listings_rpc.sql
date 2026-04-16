/*
  # Add get_nearby_listings RPC function

  ## Summary
  Creates a server-side PostgreSQL function that replaces the client-side
  haversine sort in nearby.tsx. Instead of fetching 500 rows and sorting
  in JavaScript, the app now calls this RPC which filters and sorts by
  distance in SQL, returning only the requested page.

  ## New Function
  - `get_nearby_listings(user_lat, user_lng, radius_km, lim, offset_val)`
    - Computes haversine distance in SQL
    - Filters WHERE is_active = true, latitude/longitude NOT NULL, distance_km <= radius_km
    - Returns id, name, price, photos_url, category_name, category_id,
      latitude, longitude, location_data, owner_type, distance_km
    - Sorted by distance_km ASC
    - Supports pagination via lim / offset_val

  ## Security
  - SECURITY DEFINER so it runs with elevated privileges but returns only
    columns explicitly selected (no sensitive owner data exposed here;
    the frontend joins owner separately if needed or we include safe fields)
  - STABLE because it does not modify data
*/

CREATE OR REPLACE FUNCTION get_nearby_listings(
  user_lat    double precision,
  user_lng    double precision,
  radius_km   double precision DEFAULT 50,
  lim         int              DEFAULT 40,
  offset_val  int              DEFAULT 0
)
RETURNS TABLE (
  id            uuid,
  name          text,
  price         numeric,
  photos_url    text[],
  category_name text,
  category_id   uuid,
  latitude      double precision,
  longitude     double precision,
  location_data jsonb,
  owner_type    text,
  distance_km   double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT
    l.id,
    l.name,
    l.price,
    l.photos_url,
    l.category_name,
    l.category_id,
    l.latitude,
    l.longitude,
    l.location_data,
    l.owner_type,
    (
      6371.0 * 2.0 * ATAN2(
        SQRT(
          SIN(RADIANS((l.latitude - user_lat) / 2.0)) ^ 2
          + COS(RADIANS(user_lat)) * COS(RADIANS(l.latitude))
            * SIN(RADIANS((l.longitude - user_lng) / 2.0)) ^ 2
        ),
        SQRT(
          1.0 - (
            SIN(RADIANS((l.latitude - user_lat) / 2.0)) ^ 2
            + COS(RADIANS(user_lat)) * COS(RADIANS(l.latitude))
              * SIN(RADIANS((l.longitude - user_lng) / 2.0)) ^ 2
          )
        )
      )
    ) AS distance_km
  FROM listings l
  WHERE
    l.is_active = true
    AND l.latitude  IS NOT NULL
    AND l.longitude IS NOT NULL
    AND (
      6371.0 * 2.0 * ATAN2(
        SQRT(
          SIN(RADIANS((l.latitude - user_lat) / 2.0)) ^ 2
          + COS(RADIANS(user_lat)) * COS(RADIANS(l.latitude))
            * SIN(RADIANS((l.longitude - user_lng) / 2.0)) ^ 2
        ),
        SQRT(
          1.0 - (
            SIN(RADIANS((l.latitude - user_lat) / 2.0)) ^ 2
            + COS(RADIANS(user_lat)) * COS(RADIANS(l.latitude))
              * SIN(RADIANS((l.longitude - user_lng) / 2.0)) ^ 2
          )
        )
      )
    ) <= radius_km
  ORDER BY distance_km ASC
  LIMIT lim
  OFFSET offset_val;
$$;
