/*
  # Tighten profiles visibility (audit P1-1 + P1-2)

  Background
  ----------
  - public_profiles view exposed business_address, siren_number, location_data
    to anon and authenticated. The Supabase advisor flagged it
    (security_definer_view).
  - profiles itself was guarded by "Authenticated users can view profiles
    USING (true)", which let any authenticated user SELECT every column
    (email, phone_number, role, stripe_*, account_status, …) of every
    other profile.

  Approach
  --------
  1. Replace public_profiles with a strict, SECURITY INVOKER view that only
     exposes non-PII fields. Anon callers now go through this view.
  2. Switch profiles to column-level grants:
       - anon          : same minimal column set as the view
       - authenticated : minimal set + extended fields the listing/owner
                          pages need (location_data, business_address,
                          siren_number, business_lat/lng, updated_at,
                          last_active_at, title)
       - service_role  : full access (edge functions are unaffected)
  3. Add a SECURITY DEFINER RPC `get_my_profile()` so a caller can read its
     own row in full (email, phone, role, stripe_*) — this is the only path
     that returns PII to the client and is keyed on auth.uid().
  4. Add a SELECT policy for anon (USING true). The column-level GRANT is
     what actually limits column visibility; the policy lets anon see rows
     at all.

  Out of scope (TODO before next ship)
  ------------------------------------
  - app/admin/(analytics|disputes|reports|transactions).tsx still embed
    `profiles!fkey(... email)` joins. After this migration those queries
    return permission-denied for authenticated callers (admins included),
    so they need to migrate to a SECURITY DEFINER admin RPC. Tracked as
    P1-2 follow-up.
*/

-- 1. Rebuild the view with a minimal column set
DROP VIEW IF EXISTS public.public_profiles;

CREATE VIEW public.public_profiles
WITH (security_invoker = on) AS
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
    created_at,
    display_name
  FROM public.profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;

-- 2. Column-level grants on the underlying table
REVOKE SELECT ON public.profiles FROM anon, authenticated;

GRANT SELECT (
  id, username, avatar_url, photo_url, bio,
  is_pro, business_name, business_type, business_hours,
  created_at, display_name
) ON public.profiles TO anon;

GRANT SELECT (
  id, username, avatar_url, photo_url, bio,
  is_pro, business_name, business_type, business_hours,
  created_at, display_name,
  location_data, business_address, siren_number,
  business_lat, business_lng,
  updated_at, last_active_at, title
) ON public.profiles TO authenticated;

GRANT SELECT ON public.profiles TO service_role;

-- 3. Owner self-access for protected fields
CREATE OR REPLACE FUNCTION public.get_my_profile()
RETURNS SETOF public.profiles
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT * FROM public.profiles WHERE id = auth.uid();
$$;

REVOKE ALL ON FUNCTION public.get_my_profile() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_my_profile() TO authenticated;

-- 4. Anon SELECT policy (column visibility is enforced by GRANT above)
DROP POLICY IF EXISTS "Anon can view public profile columns" ON public.profiles;
CREATE POLICY "Anon can view public profile columns"
  ON public.profiles
  FOR SELECT
  TO anon
  USING (true);
