/*
  # Add disputes table and booking owner validation

  ## Summary
  This migration adds the infrastructure for the post-return validation flow:
  
  1. New column on `bookings`:
     - `owner_validated` (boolean, default false): owner has confirmed object is OK after return
  
  2. New table `disputes`:
     - `id` (uuid, PK)
     - `booking_id` (uuid, FK → bookings)
     - `conversation_id` (uuid, FK → conversations)
     - `reporter_id` (uuid, FK → auth.users) — always the owner
     - `description` (text) — free-text explanation
     - `status` (text) — 'open' | 'under_review' | 'resolved'
     - `photo_urls` (text[]) — attached photos
     - `created_at`, `updated_at` (timestamps)
  
  ## Security
  - RLS enabled on disputes
  - Owner can insert and read their own disputes
  - Renter can read disputes on their booking
*/

-- Add owner_validated to bookings
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'owner_validated'
  ) THEN
    ALTER TABLE bookings ADD COLUMN owner_validated boolean DEFAULT false;
  END IF;
END $$;

-- Create disputes table
CREATE TABLE IF NOT EXISTS disputes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid REFERENCES bookings(id) ON DELETE CASCADE,
  conversation_id uuid,
  reporter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  description text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open',
  photo_urls text[] DEFAULT '{}',
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE disputes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Reporter can insert own dispute"
  ON disputes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Reporter can read own disputes"
  ON disputes FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);

CREATE POLICY "Renter can read disputes on their booking"
  ON disputes FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM bookings
      WHERE bookings.id = disputes.booking_id
      AND bookings.renter_id = auth.uid()
    )
  );

CREATE POLICY "Reporter can update own dispute"
  ON disputes FOR UPDATE
  TO authenticated
  USING (auth.uid() = reporter_id)
  WITH CHECK (auth.uid() = reporter_id);
