/*
  # Security MVP fixes — profiles policy + public_profiles view hardening

  ## Summary
  This migration applies 2 targeted security fixes identified post-audit:

  ## Fix 1: profiles — Drop legacy broad SELECT policy "Profil public en lecture"
  The previous migration dropped "Authenticated can read public profile fields" but
  a legacy policy named "Profil public en lecture" also exists on profiles and grants
  broad public read access. This migration drops it.

  After both drops, the only remaining SELECT access on profiles is:
  - Own profile (auth.uid() = id)
  - Admin accounts (role = 'admin')
  No anonymous or broad authenticated read remains on the base profiles table.

  ## Fix 2: public_profiles view — Remove sensitive business/location fields
  The existing public_profiles view still exposed:
  - business_address
  - siren_number
  - location_data
  These fields are sensitive (home address, tax ID, GPS coordinates) and must not
  be publicly readable without authentication context.

  The view is dropped and recreated with a minimal safe field set:
  - id, username, avatar_url, photo_url, bio
  - is_pro, business_name, business_type, business_hours
  - created_at

  Grants are preserved: authenticated and anon can SELECT on the view.

  ## Tables / Objects Modified
  - profiles: DROP 1 legacy SELECT policy
  - public_profiles view: dropped and recreated with minimal field set

  ## Important Notes
  1. No data is modified — view and policy changes only
  2. business_address, siren_number and location_data are no longer in the public view
  3. If any screen needs location_data, it must query the listing directly
*/

-- ============================================================
-- FIX 1: Drop legacy broad SELECT policy on profiles
-- ============================================================

DROP POLICY IF EXISTS "Profil public en lecture" ON public.profiles;

-- ============================================================
-- FIX 2: Recreate public_profiles view with minimal safe fields
-- ============================================================

DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles
WITH (security_invoker = true)
AS
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
    created_at
  FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;
