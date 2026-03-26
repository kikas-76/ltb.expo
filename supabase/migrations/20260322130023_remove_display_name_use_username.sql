/*
  # Remove display_name column, use username as primary identity

  ## Summary
  The `display_name` column (real first/last name) is removed from `profiles`.
  The `username` pseudonym is now the sole identifier used in the application,
  protecting user privacy everywhere including messaging.

  ## Changes
  ### Modified Tables
  - `profiles`
    - Removed: `display_name` (text)
    - `username` is now NOT NULL (enforced after backfilling)

  ## Notes
  - Existing rows that have no username get a fallback value to prevent data loss
    before we apply the NOT NULL constraint.
*/

DO $$
BEGIN
  UPDATE profiles SET username = 'user_' || substr(replace(id::text, '-', ''), 1, 8)
  WHERE username IS NULL OR username = '';
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'username'
  ) THEN
    ALTER TABLE profiles ALTER COLUMN username SET NOT NULL;
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'display_name'
  ) THEN
    ALTER TABLE profiles DROP COLUMN display_name;
  END IF;
END $$;
