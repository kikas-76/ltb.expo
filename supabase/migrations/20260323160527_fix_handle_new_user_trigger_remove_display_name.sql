/*
  # Fix handle_new_user trigger

  ## Problem
  The trigger function references the `display_name` column which was dropped
  in a previous migration. This causes "Database error saving new user" on signup.

  ## Fix
  Rewrite the trigger to only use columns that exist: id, email, photo_url, username.
*/

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
begin
  insert into public.profiles (id, email, username, photo_url)
  values (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'username',
      split_part(new.email, '@', 1)
    ),
    new.raw_user_meta_data->>'photo_url'
  )
  on conflict (id) do update
    set email = excluded.email;
  return new;
end;
$$;
