/*
  # Add professional business fields to profiles

  ## Summary
  Adds business-specific fields for professional users:
  - business_address: address of the shop/company (replaces personal address for pros)
  - business_hours: JSONB storing opening hours per day of the week
  - business_type: type of business (e.g., "Magasin de location", "Auto-entrepreneur", etc.)
  - business_name: optional trade name / company name

  ## New Columns
  - `business_address` (text, nullable) - Physical address of the business
  - `business_lat` (float8, nullable) - Latitude of the business address
  - `business_lng` (float8, nullable) - Longitude of the business address
  - `business_hours` (jsonb, nullable) - Opening hours per day: { monday: { open: "09:00", close: "18:00", closed: false }, ... }
  - `business_type` (text, nullable) - Type of business activity
  - `business_name` (text, nullable) - Trade name / company name

  ## Notes
  - Only relevant when is_pro = true
  - RLS: users can update their own business fields
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'business_address'
  ) THEN
    ALTER TABLE profiles ADD COLUMN business_address text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'business_lat'
  ) THEN
    ALTER TABLE profiles ADD COLUMN business_lat float8;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'business_lng'
  ) THEN
    ALTER TABLE profiles ADD COLUMN business_lng float8;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'business_hours'
  ) THEN
    ALTER TABLE profiles ADD COLUMN business_hours jsonb;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'business_type'
  ) THEN
    ALTER TABLE profiles ADD COLUMN business_type text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'business_name'
  ) THEN
    ALTER TABLE profiles ADD COLUMN business_name text;
  END IF;
END $$;
