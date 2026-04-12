/*
  # Fix infinite recursion in profiles RLS policies

  ## Problem
  The "Admin full read profiles" SELECT policy was causing infinite recursion
  because it referenced the `profiles` table itself in its subquery to check
  if the user is an admin. This triggered the same SELECT policy again, creating
  an infinite loop.

  ## Changes
  1. Drop the recursive "Admin full read profiles" policy
  2. Replace it with a non-recursive version using auth.jwt() app_metadata
     to check the admin role without querying the profiles table
  3. Keep the "Profil public en lecture" policy (public read is intentional
     for displaying user profiles on listings/chats)
*/

DROP POLICY IF EXISTS "Admin full read profiles" ON profiles;

CREATE POLICY "Admin full read profiles"
  ON profiles
  FOR SELECT
  TO authenticated
  USING (
    (auth.jwt() -> 'app_metadata' ->> 'role') = 'admin'
    OR (SELECT auth.uid()) = id
  );
