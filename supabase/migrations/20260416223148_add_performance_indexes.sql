/*
  # Performance Indexes

  Adds composite indexes to speed up the most common query patterns across the app.

  ## New Indexes

  ### listings table
  - `(created_at DESC) WHERE is_active` - for home feed sorted by newest
  - `(price ASC) WHERE is_active` - for deals/price sorting
  - `(views_count DESC) WHERE is_active` - for popular by views
  - `(saves_count DESC) WHERE is_active` - for popular by saves
  - `(category_name) WHERE is_active` - for category filtering
  - `(owner_id)` - foreign key join speedup

  ### saved_listings table
  - `(user_id, listing_id)` - composite for favorite checks

  ### listing_views table
  - `(listing_id)` - for counting views per listing

  ### conversations table
  - `(listing_id, requester_id)` - for existing conversation lookup
  - `(owner_id, status)` - for owner's conversation list

  ### bookings table
  - `(listing_id, status)` - for checking active bookings per listing
  - `(renter_id, status)` - for renter's booking list

  ## Notes
  - All indexes are partial (WHERE is_active = true) to reduce index size
  - Uses IF NOT EXISTS to be idempotent
*/

CREATE INDEX IF NOT EXISTS idx_listings_active_created
  ON listings (created_at DESC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_listings_active_price
  ON listings (price ASC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_listings_active_views
  ON listings (views_count DESC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_listings_active_saves
  ON listings (saves_count DESC)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_listings_active_category
  ON listings (category_name)
  WHERE is_active = true;

CREATE INDEX IF NOT EXISTS idx_listings_owner_id
  ON listings (owner_id);

CREATE INDEX IF NOT EXISTS idx_saved_listings_user_listing
  ON saved_listings (user_id, listing_id);

CREATE INDEX IF NOT EXISTS idx_listing_views_listing_id
  ON listing_views (listing_id);

CREATE INDEX IF NOT EXISTS idx_conversations_listing_requester
  ON conversations (listing_id, requester_id);

CREATE INDEX IF NOT EXISTS idx_conversations_owner_status
  ON conversations (owner_id, status);

CREATE INDEX IF NOT EXISTS idx_bookings_listing_status
  ON bookings (listing_id, status);

CREATE INDEX IF NOT EXISTS idx_bookings_renter_status
  ON bookings (renter_id, status);
