/*
  # Add listing views tracking table

  1. New Tables
    - `listing_views`
      - `id` (uuid, primary key)
      - `listing_id` (uuid, FK to listings)
      - `viewer_id` (uuid, nullable FK to profiles — null for anonymous)
      - `viewed_at` (timestamptz)

  2. Security
    - Enable RLS
    - Anyone (authenticated or not) can insert a view
    - Only the listing owner can read views for their own listing
*/

CREATE TABLE IF NOT EXISTS listing_views (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid NOT NULL REFERENCES listings(id) ON DELETE CASCADE,
  viewer_id uuid REFERENCES profiles(id) ON DELETE SET NULL,
  viewed_at timestamptz DEFAULT now()
);

ALTER TABLE listing_views ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can record a view"
  ON listing_views FOR INSERT
  TO anon, authenticated
  WITH CHECK (true);

CREATE POLICY "Owner can read views of their listings"
  ON listing_views FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM listings
      WHERE listings.id = listing_views.listing_id
      AND listings.owner_id = auth.uid()
    )
  );
