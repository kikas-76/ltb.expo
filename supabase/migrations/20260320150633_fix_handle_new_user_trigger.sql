/*
  # Fix handle_new_user trigger to handle conflicts

  ## Problem
  The trigger `handle_new_user` fails with "Database error saving new user" when:
  - A user already has a profile row (e.g., from a previous partial registration)
  - There is a primary key conflict on `profiles.id`

  ## Fix
  Replace the INSERT with an INSERT ... ON CONFLICT DO NOTHING so that if a
  profile row already exists for the user, the trigger succeeds silently instead
  of raising an exception that blocks the auth signup.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  insert into public.profiles (id, email, display_name, photo_url)
  values (
    new.id,
    new.email,
    coalesce(new.raw_user_meta_data->>'display_name', split_part(new.email, '@', 1)),
    new.raw_user_meta_data->>'photo_url'
  )
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;
