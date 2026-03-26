/*
  # Add location_data to profiles

  ## Changes
  - Adds `location_data` JSONB column to the `profiles` table
  - Stores { address: string, lat: number | null, lng: number | null }
  - Set during onboarding Step 4 (address screen)
  - Null by default (optional step)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'location_data'
  ) THEN
    ALTER TABLE profiles ADD COLUMN location_data jsonb DEFAULT NULL;
  END IF;
END $$;
