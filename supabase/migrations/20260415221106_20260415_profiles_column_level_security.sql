/*
  # Profiles — Column-Level Security via Security Barrier View

  ## Summary
  The previous migration created a public_profiles view but the profiles table
  still had a broad USING(true) SELECT for authenticated users, which means any
  authenticated user could still call .from('profiles').select('stripe_customer_id')
  and get results.

  This migration replaces the broad authenticated SELECT with a more precise approach:
  - Authenticated users can read ALL columns of their OWN profile (for settings/profile pages)
  - Authenticated users can read only PUBLIC columns of OTHER profiles
    (for listing pages, owner pages, etc.) — enforced via the security barrier view
  - Admins can read all columns of all profiles

  The approach:
  1. Drop "Authenticated can read public profile fields" (already done in previous migration)
  2. The existing "Admin full read profiles" handles: admin = all, owner = own profile
  3. We need a way for authenticated users to read OTHER profiles' public fields.
     Since RLS cannot restrict columns, we use the public_profiles VIEW which
     already uses SECURITY INVOKER. The view has no RLS — it inherits the underlying
     table's RLS via security invoker.
     
     BUT: the view with security_invoker will also be blocked by the table RLS
     for non-owner rows since "Admin full read profiles" only allows own profile or admin.
     
  ## Fix
  Add a specific policy for reading OTHER users' public profile data, but only
  through the public_profiles view. We achieve this with a separate permissive policy
  that allows authenticated users to read profiles — but application code MUST use
  public_profiles for cross-user reads. The table SELECT will work, but we document
  that sensitive columns must NEVER be selected in public-facing queries.

  This is pragmatic: PostgREST column-level security via views is the industry standard.
  
  ## What this migration does
  1. Recreates public_profiles as a SECURITY DEFINER view (so it bypasses RLS on the
     underlying table, but only exposes the safe columns we choose)
  2. Keeps the "Admin full read profiles" policy as-is (own profile + admin)
  3. Adds NO additional policy — the security barrier view is the control point
  
  ## Result
  - Unauthenticated users: can only read via public_profiles view (safe columns only)
  - Authenticated users querying profiles table directly: only their own row or all if admin
  - Authenticated users querying public_profiles view: any row, but only safe columns
  - Application code for owner pages / listing pages uses public_profiles view
*/

-- Recreate the view as SECURITY DEFINER so it bypasses table RLS
-- and always returns the safe subset of columns regardless of caller
DROP VIEW IF EXISTS public.public_profiles;

CREATE OR REPLACE VIEW public.public_profiles
WITH (security_invoker = false)
AS
  SELECT
    id,
    username,
    avatar_url,
    photo_url,
    bio,
    is_pro,
    business_name,
    business_address,
    business_type,
    business_hours,
    siren_number,
    location_data,
    created_at
  FROM public.profiles;

GRANT SELECT ON public.public_profiles TO authenticated;
GRANT SELECT ON public.public_profiles TO anon;
