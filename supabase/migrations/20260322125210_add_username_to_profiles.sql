/*
  # Add username to profiles table

  ## Summary
  Adds a `username` column to the `profiles` table. This pseudonym is mandatory
  for all users and replaces the real name in messaging to protect privacy.

  ## Changes
  ### Modified Tables
  - `profiles`
    - `username` (text, nullable initially to allow existing rows, unique)

  ## Notes
  - The column is nullable in the database to avoid breaking existing profiles,
    but the application enforces it as required during onboarding.
  - A unique constraint ensures no two users share the same username.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'username'
  ) THEN
    ALTER TABLE profiles ADD COLUMN username text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'profiles_username_key'
  ) THEN
    ALTER TABLE profiles ADD CONSTRAINT profiles_username_key UNIQUE (username);
  END IF;
END $$;
