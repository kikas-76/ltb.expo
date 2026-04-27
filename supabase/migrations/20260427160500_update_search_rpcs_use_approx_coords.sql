/*
  # Update SECURITY DEFINER search RPCs to return approx coords

  Background
  ----------
  `get_nearby_listings` and `search_listings` are SECURITY DEFINER, which
  means they bypass the column-level GRANTs we set up on public.listings.
  Both used to return l.latitude / l.longitude / l.location_data — i.e.
  every authenticated user calling them got the owner's exact GPS,
  defeating the blur introduced in 20260427160000.

  Fix
  ---
  Drop and recreate both functions with a return signature that uses the
  new approx_latitude / approx_longitude columns. Distance computation
  also uses the blurred coords; accuracy stays within ~300 m which is
  fine for nearby/search UX.

  These migrations are paired with the app-side rename of
  `latitude`/`longitude` → `approx_latitude`/`approx_longitude` in:
    - app/nearby.tsx, app/search.tsx
    - app/(tabs)/index.tsx
    - the explore section components.
*/

-- get_nearby_listings ---------------------------------------------------
DROP FUNCTION IF EXISTS public.get_nearby_listings(double precision, double precision, double precision, integer, integer);

CREATE OR REPLACE FUNCTION public.get_nearby_listings(
  user_lat   double precision,
  user_lng   double precision,
  radius_km  double precision DEFAULT 50,
  lim        integer          DEFAULT 40,
  offset_val integer          DEFAULT 0
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
  distance_km double precision
)
LANGUAGE sql
STABLE
SECURITY DEFINER
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

REVOKE ALL ON FUNCTION public.get_nearby_listings(double precision, double precision, double precision, integer, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_nearby_listings(double precision, double precision, double precision, integer, integer) TO authenticated;

-- search_listings -------------------------------------------------------
DROP FUNCTION IF EXISTS public.search_listings(text, integer);

CREATE OR REPLACE FUNCTION public.search_listings(
  search_query text,
  lim integer DEFAULT 40
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
  is_active boolean,
  rank real
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_catalog'
AS $function$
DECLARE
  clean_query  text;
  tsq_prefix   tsquery;
  tsq_web      tsquery;
  fts_count    int := 0;
BEGIN
  clean_query := trim(immutable_unaccent(search_query));

  IF clean_query = '' THEN
    RETURN QUERY
    SELECT
      l.id, l.name::text, l.price, l.photos_url, l.category_name::text,
      l.category_id, l.approx_latitude, l.approx_longitude,
      l.owner_type::text, l.is_active, 1.0::real AS rank
    FROM listings l
    WHERE l.is_active = true
    ORDER BY l.created_at DESC
    LIMIT lim;
    RETURN;
  END IF;

  BEGIN
    SELECT to_tsquery('french',
      string_agg(immutable_unaccent(word) || ':*', ' & ' ORDER BY ordinality)
    )
    INTO tsq_prefix
    FROM unnest(string_to_array(
      regexp_replace(trim(clean_query), '\s+', ' ', 'g'), ' '
    )) WITH ORDINALITY AS t(word, ordinality)
    WHERE word <> '';
  EXCEPTION WHEN OTHERS THEN
    tsq_prefix := NULL;
  END;

  BEGIN
    tsq_web := websearch_to_tsquery('french', clean_query);
  EXCEPTION WHEN OTHERS THEN
    tsq_web := NULL;
  END;

  IF tsq_prefix IS NOT NULL THEN
    SELECT count(*)::int INTO fts_count
    FROM listings l
    WHERE l.is_active = true
      AND l.search_vector @@ tsq_prefix;
  END IF;

  IF fts_count = 0 AND tsq_web IS NOT NULL THEN
    SELECT count(*)::int INTO fts_count
    FROM listings l
    WHERE l.is_active = true
      AND l.search_vector @@ tsq_web;
  END IF;

  IF fts_count > 0 THEN
    RETURN QUERY
    SELECT
      l.id, l.name::text, l.price, l.photos_url, l.category_name::text,
      l.category_id, l.approx_latitude, l.approx_longitude,
      l.owner_type::text, l.is_active,
      GREATEST(
        CASE WHEN tsq_prefix IS NOT NULL THEN ts_rank_cd(l.search_vector, tsq_prefix) ELSE 0 END,
        CASE WHEN tsq_web    IS NOT NULL THEN ts_rank_cd(l.search_vector, tsq_web)    ELSE 0 END
      ) AS rank
    FROM listings l
    WHERE l.is_active = true
      AND (
        (tsq_prefix IS NOT NULL AND l.search_vector @@ tsq_prefix)
        OR (tsq_web IS NOT NULL AND l.search_vector @@ tsq_web)
      )
    ORDER BY rank DESC, l.created_at DESC
    LIMIT lim;
    RETURN;
  END IF;

  RETURN QUERY
  SELECT
    l.id, l.name::text, l.price, l.photos_url, l.category_name::text,
    l.category_id, l.approx_latitude, l.approx_longitude,
    l.owner_type::text, l.is_active,
    similarity(lower(l.name), lower(clean_query)) AS rank
  FROM listings l
  WHERE l.is_active = true
    AND (
      lower(l.name) % lower(clean_query)
      OR lower(l.name) LIKE '%' || lower(clean_query) || '%'
      OR lower(coalesce(l.description, '')) LIKE '%' || lower(clean_query) || '%'
    )
  ORDER BY rank DESC, l.created_at DESC
  LIMIT lim;
END;
$function$;

REVOKE ALL ON FUNCTION public.search_listings(text, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.search_listings(text, integer) TO authenticated;
