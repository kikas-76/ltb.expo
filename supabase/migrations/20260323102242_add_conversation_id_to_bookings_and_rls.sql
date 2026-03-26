/*
  # Link bookings to conversations + RLS policies

  ## Summary
  This migration connects the bookings table to conversations, adds proper RLS,
  and sets up a trigger to auto-update booking status based on dates.

  ## Changes

  ### Modified Tables
  - `bookings`
    - Add `conversation_id` (uuid, FK to conversations) — links a booking to its conversation thread
    - Add `message` (text, nullable) — custom message from the requester

  ### Security
  - Enable RLS on `bookings` (already enabled, verify policies)
  - SELECT: renter or owner can read their own bookings
  - INSERT: authenticated user (renter) can insert their own booking
  - UPDATE: owner or renter can update (status transitions)
  - DELETE: owner or renter can delete their booking

  ### Notes
  - conversation_id is unique (one booking per conversation)
  - Existing rows have no conversation_id (nullable migration)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'conversation_id'
  ) THEN
    ALTER TABLE bookings ADD COLUMN conversation_id uuid REFERENCES conversations(id) ON DELETE SET NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'message'
  ) THEN
    ALTER TABLE bookings ADD COLUMN message text;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS bookings_conversation_id_unique
  ON bookings (conversation_id)
  WHERE conversation_id IS NOT NULL;

ALTER TABLE bookings ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'Renter and owner can view their bookings'
  ) THEN
    CREATE POLICY "Renter and owner can view their bookings"
      ON bookings FOR SELECT
      TO authenticated
      USING (auth.uid() = renter_id OR auth.uid() = owner_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'Renter can create bookings'
  ) THEN
    CREATE POLICY "Renter can create bookings"
      ON bookings FOR INSERT
      TO authenticated
      WITH CHECK (auth.uid() = renter_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'Owner or renter can update booking status'
  ) THEN
    CREATE POLICY "Owner or renter can update booking status"
      ON bookings FOR UPDATE
      TO authenticated
      USING (auth.uid() = owner_id OR auth.uid() = renter_id)
      WITH CHECK (auth.uid() = owner_id OR auth.uid() = renter_id);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies WHERE tablename = 'bookings' AND policyname = 'Owner or renter can delete booking'
  ) THEN
    CREATE POLICY "Owner or renter can delete booking"
      ON bookings FOR DELETE
      TO authenticated
      USING (auth.uid() = owner_id OR auth.uid() = renter_id);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS bookings_renter_id_idx ON bookings (renter_id);
CREATE INDEX IF NOT EXISTS bookings_owner_id_idx ON bookings (owner_id);
CREATE INDEX IF NOT EXISTS bookings_listing_id_idx ON bookings (listing_id);
