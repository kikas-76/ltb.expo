/*
  # Add bio column to profiles table

  1. Changes
    - Add `bio` column (text, nullable) to the `profiles` table
    - This field allows users to write a short description about themselves
    - It is displayed publicly on their owner profile page
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'bio'
  ) THEN
    ALTER TABLE profiles ADD COLUMN bio text DEFAULT NULL;
  END IF;
END $$;
