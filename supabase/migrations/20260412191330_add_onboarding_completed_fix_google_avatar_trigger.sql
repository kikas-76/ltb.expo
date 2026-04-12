/*
  # Add onboarding_completed flag and fix Google avatar in trigger

  ## Changes

  1. New column
    - `profiles.onboarding_completed` (boolean, default false)
      Tracks whether the user has completed the onboarding flow.
      This is needed because Google OAuth users get a username auto-assigned
      by the trigger (from their email), so we can't use username presence
      as a proxy for onboarding completion.

  2. Fix trigger
    - Read Google avatar from `avatar_url` or `picture` in raw_user_meta_data
      (Google OAuth stores the profile picture in these fields, not `photo_url`)
    - Do NOT auto-set username from email anymore — leave it null so the
      existing `!profile?.username` guard still works for email signups.
      For Google signups, `onboarding_completed = false` is the gate.

  ## Notes
  - Existing users who already have a username AND went through onboarding
    are backfilled to onboarding_completed = true.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'onboarding_completed'
  ) THEN
    ALTER TABLE profiles ADD COLUMN onboarding_completed boolean NOT NULL DEFAULT false;
  END IF;
END $$;

UPDATE profiles
SET onboarding_completed = true
WHERE username IS NOT NULL AND onboarding_completed = false;

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  insert into public.profiles (id, email, photo_url, onboarding_completed)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture',
      new.raw_user_meta_data->>'photo_url'
    ),
    false
  )
  on conflict (id) do update
    set email = excluded.email,
        photo_url = coalesce(
          new.raw_user_meta_data->>'avatar_url',
          new.raw_user_meta_data->>'picture',
          new.raw_user_meta_data->>'photo_url',
          profiles.photo_url
        );
  return new;
end;
$$;
