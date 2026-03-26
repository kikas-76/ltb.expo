/*
  # Add updated_at column to profiles

  1. Changes
    - Add `updated_at` column to `profiles` table with default value of now()
    - This fixes the trigger `profiles_updated_at` that calls `update_updated_at()` 
      which was failing because the column didn't exist
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'updated_at'
  ) THEN
    ALTER TABLE profiles ADD COLUMN updated_at timestamptz DEFAULT now();
  END IF;
END $$;
