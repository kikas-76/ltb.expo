-- Mettre à jour le trigger pour extraire display_name depuis Google metadata
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
BEGIN
  INSERT INTO public.profiles (id, email, photo_url, display_name, onboarding_completed)
  VALUES (
    new.id,
    new.email,
    coalesce(
      new.raw_user_meta_data->>'avatar_url',
      new.raw_user_meta_data->>'picture',
      new.raw_user_meta_data->>'photo_url'
    ),
    coalesce(
      new.raw_user_meta_data->>'full_name',
      new.raw_user_meta_data->>'name',
      new.raw_user_meta_data->>'user_name'
    ),
    false
  )
  ON CONFLICT (id) DO UPDATE
  SET email = excluded.email,
      photo_url = coalesce(
        new.raw_user_meta_data->>'avatar_url',
        new.raw_user_meta_data->>'picture',
        new.raw_user_meta_data->>'photo_url',
        profiles.photo_url
      ),
      display_name = coalesce(
        profiles.display_name,
        new.raw_user_meta_data->>'full_name',
        new.raw_user_meta_data->>'name'
      );
  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
