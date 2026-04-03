/*
  # Add return_confirmed_at to bookings

  1. Changes
    - `bookings` table: add `return_confirmed_at` (timestamptz) — set when both parties have confirmed the return, starts the 24h owner validation window
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'return_confirmed_at'
  ) THEN
    ALTER TABLE bookings ADD COLUMN return_confirmed_at timestamptz;
  END IF;
END $$;
