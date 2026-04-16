/*
  # Add views_count and saves_count counters to listings

  ## Summary
  Adds denormalized counter columns to the listings table so the popular.tsx
  page can retrieve view and save counts in a single query instead of making
  3 separate round-trips (listings + listing_views + saved_listings).

  ## Changes

  ### Modified Table: listings
  - `views_count` integer NOT NULL DEFAULT 0 — total number of times this listing has been viewed
  - `saves_count` integer NOT NULL DEFAULT 0 — total number of times this listing has been saved/favourited

  ### Data Backfill
  Both counters are populated from the existing listing_views and saved_listings tables.

  ### New Triggers
  1. `trg_listing_views_insert` — increments views_count on INSERT into listing_views
  2. `trg_listing_views_delete` — decrements views_count (min 0) on DELETE from listing_views
  3. `trg_saved_listings_insert` — increments saves_count on INSERT into saved_listings
  4. `trg_saved_listings_delete` — decrements saves_count (min 0) on DELETE from saved_listings

  ## Notes
  - Counters are maintained automatically going forward via triggers
  - GREATEST(..., 0) guards against any accidental negative values
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'views_count'
  ) THEN
    ALTER TABLE listings ADD COLUMN views_count integer NOT NULL DEFAULT 0;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'listings' AND column_name = 'saves_count'
  ) THEN
    ALTER TABLE listings ADD COLUMN saves_count integer NOT NULL DEFAULT 0;
  END IF;
END $$;

UPDATE listings
SET views_count = (
  SELECT COUNT(*) FROM listing_views WHERE listing_id = listings.id
);

UPDATE listings
SET saves_count = (
  SELECT COUNT(*) FROM saved_listings WHERE listing_id = listings.id
);

CREATE OR REPLACE FUNCTION fn_increment_views_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE listings SET views_count = views_count + 1 WHERE id = NEW.listing_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_decrement_views_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE listings SET views_count = GREATEST(views_count - 1, 0) WHERE id = OLD.listing_id;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE FUNCTION fn_increment_saves_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE listings SET saves_count = saves_count + 1 WHERE id = NEW.listing_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION fn_decrement_saves_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE listings SET saves_count = GREATEST(saves_count - 1, 0) WHERE id = OLD.listing_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_listing_views_insert ON listing_views;
CREATE TRIGGER trg_listing_views_insert
  AFTER INSERT ON listing_views
  FOR EACH ROW EXECUTE FUNCTION fn_increment_views_count();

DROP TRIGGER IF EXISTS trg_listing_views_delete ON listing_views;
CREATE TRIGGER trg_listing_views_delete
  AFTER DELETE ON listing_views
  FOR EACH ROW EXECUTE FUNCTION fn_decrement_views_count();

DROP TRIGGER IF EXISTS trg_saved_listings_insert ON saved_listings;
CREATE TRIGGER trg_saved_listings_insert
  AFTER INSERT ON saved_listings
  FOR EACH ROW EXECUTE FUNCTION fn_increment_saves_count();

DROP TRIGGER IF EXISTS trg_saved_listings_delete ON saved_listings;
CREATE TRIGGER trg_saved_listings_delete
  AFTER DELETE ON saved_listings
  FOR EACH ROW EXECUTE FUNCTION fn_decrement_saves_count();
