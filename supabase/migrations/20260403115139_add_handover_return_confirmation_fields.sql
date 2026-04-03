/*
  # Add handover and return confirmation fields to bookings

  ## Summary
  Adds 4 boolean fields to track whether each party (owner + renter) has confirmed:
  1. The item handover (start of rental) → triggers status change to 'in_progress'
  2. The item return (end of rental) → triggers status change to 'completed'

  Also adds 'in_progress' as a first-class booking status (previously calculated client-side).

  ## New Columns on `bookings`
  - `handover_confirmed_owner` (boolean, DEFAULT false) — owner confirmed handover
  - `handover_confirmed_renter` (boolean, DEFAULT false) — renter confirmed handover
  - `return_confirmed_owner` (boolean, DEFAULT false) — owner confirmed return
  - `return_confirmed_renter` (boolean, DEFAULT false) — renter confirmed return

  ## Notes
  - Status 'in_progress' is set when BOTH handover confirmations are true
  - Status 'completed' is set when BOTH return confirmations are true
  - The status transitions are handled by the application layer via DB updates
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'handover_confirmed_owner'
  ) THEN
    ALTER TABLE bookings ADD COLUMN handover_confirmed_owner boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'handover_confirmed_renter'
  ) THEN
    ALTER TABLE bookings ADD COLUMN handover_confirmed_renter boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'return_confirmed_owner'
  ) THEN
    ALTER TABLE bookings ADD COLUMN return_confirmed_owner boolean DEFAULT false;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'return_confirmed_renter'
  ) THEN
    ALTER TABLE bookings ADD COLUMN return_confirmed_renter boolean DEFAULT false;
  END IF;
END $$;
