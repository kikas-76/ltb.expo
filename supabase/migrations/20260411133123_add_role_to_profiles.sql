/*
  # Add role column to profiles table

  ## Summary
  Adds a `role` column to the `profiles` table to support admin access control.

  ## Changes
  - `profiles` table: new `role` column (text, nullable, default 'user')

  ## Notes
  - Existing rows will have role = 'user' by default
  - Admin users can be manually set to role = 'admin'
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'role'
  ) THEN
    ALTER TABLE profiles ADD COLUMN role text DEFAULT 'user';
  END IF;
END $$;
