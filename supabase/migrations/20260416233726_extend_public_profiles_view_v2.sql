-- Must drop and recreate since we're adding columns in the middle
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles AS
SELECT
  id,
  username,
  avatar_url,
  photo_url,
  bio,
  is_pro,
  business_name,
  business_type,
  business_hours,
  business_address,
  siren_number,
  location_data,
  created_at
FROM profiles;

-- Ensure anon/authenticated can read the view
GRANT SELECT ON public.public_profiles TO anon, authenticated;
