/*
  # Fix username column to allow NULL for new Google OAuth users

  ## Problem
  The `username` column in `profiles` is NOT NULL with no default value.
  The `handle_new_user` trigger only inserts id, email, photo_url, and
  onboarding_completed — it does not insert a username. This causes a
  NOT NULL constraint violation when a new user signs up via Google OAuth,
  which Supabase surfaces as "Database error saving new user".

  ## Fix
  - Make `username` nullable so the trigger can create the profile row
    without a username. The user will set their username during onboarding.

  ## Notes
  - Existing rows are unaffected (their usernames remain set).
  - The onboarding flow already gates on `onboarding_completed = false`,
    so users without a username will be routed to onboarding as expected.
*/

ALTER TABLE public.profiles
  ALTER COLUMN username DROP NOT NULL;
