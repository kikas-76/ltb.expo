/*
  # Add phone_number to profiles

  ## Changes
  - Adds optional `phone_number` text column to the `profiles` table
  - Used to store user phone numbers collected during onboarding Step 2
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'phone_number'
  ) THEN
    ALTER TABLE profiles ADD COLUMN phone_number text DEFAULT NULL;
  END IF;
END $$;
