/*
  # Full-Text Search on listings

  ## Summary
  Implements native PostgreSQL full-text search on the listings table using a trigger-maintained
  tsvector column, a GIN index, trigram indexes for autocomplete, a search_history table, and
  two helper RPC functions: search_listings and get_search_suggestions.

  ## Changes

  ### 1. Extensions
  - pg_trgm: trigram similarity for autocomplete/fuzzy matching
  - unaccent: accent-insensitive matching

  ### 2. New column: listings.search_vector (tsvector)
  - Maintained by trigger on INSERT/UPDATE
  - Weighted: name=A, description=B, category_name=C, location city/address=D
  - French language stemming + unaccent

  ### 3. Indexes
  - GIN index on search_vector for fast FTS queries
  - pg_trgm GIN index on name for autocomplete

  ### 4. New table: search_history
  - Per-user query history (recent searches)
  - RLS: authenticated users can only access their own rows

  ### 5. RPC functions
  - search_listings(query, lim): ranked FTS with prefix matching, trigram fallback
  - get_search_suggestions(prefix, lim): autocomplete from listing names

  ## Security
  - RLS enabled on search_history
  - Functions use SECURITY DEFINER with input sanitisation
*/

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS pg_trgm;
CREATE EXTENSION IF NOT EXISTS unaccent;

-- Create immutable unaccent wrapper required for indexes/triggers
CREATE OR REPLACE FUNCTION immutable_unaccent(text)
RETURNS text
LANGUAGE sql
IMMUTABLE
PARALLEL SAFE
AS $$
  SELECT unaccent($1);
$$;

-- Add search_vector column (not generated — maintained by trigger)
ALTER TABLE listings
  ADD COLUMN IF NOT EXISTS search_vector tsvector;

-- Populate existing rows
UPDATE listings SET search_vector =
  setweight(to_tsvector('french', immutable_unaccent(coalesce(name, ''))), 'A') ||
  setweight(to_tsvector('french', immutable_unaccent(coalesce(description, ''))), 'B') ||
  setweight(to_tsvector('french', immutable_unaccent(coalesce(category_name, ''))), 'C') ||
  setweight(to_tsvector('french', immutable_unaccent(coalesce(
    location_data->>'city', location_data->>'address', ''
  ))), 'D');

-- Trigger function to keep search_vector up to date
CREATE OR REPLACE FUNCTION listings_search_vector_update()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.search_vector :=
    setweight(to_tsvector('french', immutable_unaccent(coalesce(NEW.name, ''))), 'A') ||
    setweight(to_tsvector('french', immutable_unaccent(coalesce(NEW.description, ''))), 'B') ||
    setweight(to_tsvector('french', immutable_unaccent(coalesce(NEW.category_name, ''))), 'C') ||
    setweight(to_tsvector('french', immutable_unaccent(coalesce(
      NEW.location_data->>'city', NEW.location_data->>'address', ''
    ))), 'D');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS listings_search_vector_trig ON listings;
CREATE TRIGGER listings_search_vector_trig
  BEFORE INSERT OR UPDATE OF name, description, category_name, location_data
  ON listings
  FOR EACH ROW
  EXECUTE FUNCTION listings_search_vector_update();

-- GIN index on tsvector
CREATE INDEX IF NOT EXISTS listings_search_vector_idx
  ON listings USING gin(search_vector);

-- Trigram GIN index on name for autocomplete
CREATE INDEX IF NOT EXISTS listings_name_trgm_idx
  ON listings USING gin(name gin_trgm_ops);

-- ─── search_history table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS search_history (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  query        text NOT NULL,
  result_count integer DEFAULT 0,
  searched_at  timestamptz DEFAULT now()
);

ALTER TABLE search_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own search history"
  ON search_history FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own search history"
  ON search_history FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can delete own search history"
  ON search_history FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS search_history_user_idx
  ON search_history(user_id, searched_at DESC);

-- ─── RPC: search_listings ───────────────────────────────────────────────────

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
  tsq          tsquery;
  clean_query  text;
  fts_found    boolean := false;
BEGIN
  clean_query := trim(immutable_unaccent(search_query));

  IF clean_query = '' THEN
    RETURN QUERY
      SELECT
        l.id, l.name, l.price, l.photos_url, l.category_name,
        l.category_id, l.latitude, l.longitude, l.location_data,
        l.owner_type, l.is_active, 1.0::real AS rank
      FROM listings l
      WHERE l.is_active = true
      ORDER BY l.created_at DESC
      LIMIT lim;
    RETURN;
  END IF;

  -- Build prefix tsquery (each word + :*)
  BEGIN
    SELECT to_tsquery('french',
      string_agg(immutable_unaccent(word) || ':*', ' & ')
    )
    INTO tsq
    FROM unnest(string_to_array(
      regexp_replace(trim(clean_query), '\s+', ' ', 'g'), ' '
    )) AS word
    WHERE word <> '';
  EXCEPTION WHEN OTHERS THEN
    tsq := NULL;
  END;

  IF tsq IS NOT NULL THEN
    RETURN QUERY
      SELECT
        l.id, l.name, l.price, l.photos_url, l.category_name,
        l.category_id, l.latitude, l.longitude, l.location_data,
        l.owner_type, l.is_active,
        ts_rank_cd(l.search_vector, tsq) AS rank
      FROM listings l
      WHERE l.is_active = true
        AND l.search_vector @@ tsq
      ORDER BY rank DESC, l.created_at DESC
      LIMIT lim;

    GET DIAGNOSTICS fts_found = ROW_COUNT;
  END IF;

  IF NOT fts_found OR fts_found = 0 THEN
    -- Trigram fallback
    RETURN QUERY
      SELECT
        l.id, l.name, l.price, l.photos_url, l.category_name,
        l.category_id, l.latitude, l.longitude, l.location_data,
        l.owner_type, l.is_active,
        similarity(lower(l.name), lower(clean_query)) AS rank
      FROM listings l
      WHERE l.is_active = true
        AND (
          lower(l.name) % lower(clean_query)
          OR lower(l.name) LIKE '%' || lower(clean_query) || '%'
        )
      ORDER BY rank DESC, l.created_at DESC
      LIMIT lim;
  END IF;
END;
$$;

-- ─── RPC: get_search_suggestions ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION get_search_suggestions(
  prefix       text,
  lim          int DEFAULT 8
)
RETURNS TABLE (
  suggestion   text,
  category     text
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT DISTINCT ON (lower(l.name))
    l.name AS suggestion,
    l.category_name AS category
  FROM listings l
  WHERE l.is_active = true
    AND lower(l.name) LIKE '%' || lower(trim(immutable_unaccent(prefix))) || '%'
  ORDER BY lower(l.name),
    similarity(lower(l.name), lower(trim(immutable_unaccent(prefix)))) DESC
  LIMIT lim;
$$;
