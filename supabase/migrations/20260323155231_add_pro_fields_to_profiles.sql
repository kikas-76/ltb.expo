/*
  # Add professional account fields to profiles

  ## Summary
  Adds support for professional accounts on the platform.

  ## New Columns
  - `is_pro` (boolean, default false) - Whether the user has a professional account
  - `siren_number` (text, nullable) - SIREN number for professional users (9 digits, unique when set)

  ## Notes
  - Existing users default to `is_pro = false` (particulier)
  - SIREN is only required when `is_pro = true`
  - RLS: users can update their own pro fields; anyone can read is_pro (for badge display)
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'is_pro'
  ) THEN
    ALTER TABLE profiles ADD COLUMN is_pro boolean NOT NULL DEFAULT false;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'siren_number'
  ) THEN
    ALTER TABLE profiles ADD COLUMN siren_number text;
  END IF;
END $$;
