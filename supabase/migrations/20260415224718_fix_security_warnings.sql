-- Fix search_path mutable sur prevent_role_self_update
CREATE OR REPLACE FUNCTION public.prevent_role_self_update()
RETURNS trigger AS $$
BEGIN
  IF OLD.role IS DISTINCT FROM NEW.role THEN
    IF NOT (
      coalesce(current_setting('request.jwt.claims', true)::jsonb->>'role', '') = 'service_role'
    ) THEN
      NEW.role := OLD.role;
    END IF;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Fix search_path mutable sur handle_new_user
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
$$ LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public;

-- Force SECURITY INVOKER sur la vue public_profiles
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles
WITH (security_invoker = true) AS
SELECT id, username, display_name, avatar_url, photo_url, bio, is_pro,
       business_name, business_address, business_type,
       business_hours, siren_number, location_data, created_at
FROM profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;
