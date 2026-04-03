/*
  # Fix search_listings function

  ## Problem
  The previous implementation used `GET DIAGNOSTICS fts_found = ROW_COUNT` after
  `RETURN QUERY`, which does not work as expected in PL/pgSQL — ROW_COUNT reflects
  the rows *sent*, but the function returns a set and cannot branch after RETURN QUERY.

  ## Solution
  Rewrite using a two-pass approach:
  1. First execute the FTS query into a temp variable to check if results exist
  2. If FTS returns results, return them
  3. Otherwise fall back to trigram LIKE matching

  Also ensures the tsquery is built correctly using `websearch_to_tsquery` as primary
  method (more robust for multi-word queries with proper nouns) with prefix matching
  fallback.
*/

CREATE OR REPLACE FUNCTION search_listings(
  search_query   text,
  lim            int DEFAULT 40
)
RETURNS TABLE (
  id             uuid,
  name           text,
  price          numeric,
  photos_url     text[],
  category_name  text,
  category_id    uuid,
  latitude       double precision,
  longitude      double precision,
  location_data  jsonb,
  owner_type     text,
  is_active      boolean,
  rank           real
)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
AS $$
DECLARE
  clean_query  text;
  tsq_prefix   tsquery;
  tsq_web      tsquery;
  fts_count    int := 0;
BEGIN
  clean_query := trim(immutable_unaccent(search_query));

  -- Empty query: return latest listings
  IF clean_query = '' THEN
    RETURN QUERY
      SELECT
        l.id, l.name::text, l.price, l.photos_url, l.category_name::text,
        l.category_id, l.latitude, l.longitude, l.location_data,
        l.owner_type::text, l.is_active, 1.0::real AS rank
      FROM listings l
      WHERE l.is_active = true
      ORDER BY l.created_at DESC
      LIMIT lim;
    RETURN;
  END IF;

  -- Build prefix tsquery (each word + :*)
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

  -- Also try websearch_to_tsquery for natural language (handles proper nouns better)
  BEGIN
    tsq_web := websearch_to_tsquery('french', clean_query);
  EXCEPTION WHEN OTHERS THEN
    tsq_web := NULL;
  END;

  -- Count FTS matches using prefix query first
  IF tsq_prefix IS NOT NULL THEN
    SELECT count(*)::int INTO fts_count
    FROM listings l
    WHERE l.is_active = true
      AND l.search_vector @@ tsq_prefix;
  END IF;

  -- If prefix matched nothing, try websearch query
  IF fts_count = 0 AND tsq_web IS NOT NULL THEN
    SELECT count(*)::int INTO fts_count
    FROM listings l
    WHERE l.is_active = true
      AND l.search_vector @@ tsq_web;
  END IF;

  -- Return FTS results if any found
  IF fts_count > 0 THEN
    IF tsq_prefix IS NOT NULL THEN
      SELECT count(*)::int INTO fts_count
      FROM listings l
      WHERE l.is_active = true
        AND l.search_vector @@ tsq_prefix;
    END IF;

    -- Use prefix query preferably, fall back to websearch
    RETURN QUERY
      SELECT
        l.id, l.name::text, l.price, l.photos_url, l.category_name::text,
        l.category_id, l.latitude, l.longitude, l.location_data,
        l.owner_type::text, l.is_active,
        GREATEST(
          CASE WHEN tsq_prefix IS NOT NULL THEN ts_rank_cd(l.search_vector, tsq_prefix) ELSE 0 END,
          CASE WHEN tsq_web IS NOT NULL THEN ts_rank_cd(l.search_vector, tsq_web) ELSE 0 END
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

  -- Fallback: trigram LIKE matching
  RETURN QUERY
    SELECT
      l.id, l.name::text, l.price, l.photos_url, l.category_name::text,
      l.category_id, l.latitude, l.longitude, l.location_data,
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
$$;
