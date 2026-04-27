/*
  # Prevent users from modifying sensitive profile columns directly

  ## Background
  RLS policy "Users can update own profile" allows authenticated users to
  UPDATE their own row, but PostgreSQL RLS has no column-level granularity.
  Without this trigger any user could escalate by setting profiles.role =
  'admin', unban themselves via account_status, or forge a stripe_account_id
  to hijack payouts.

  ## Approach
  BEFORE UPDATE trigger that:
  - Bypasses for service_role (edge functions): JWT claim `role` = service_role
  - Bypasses for verified admins: JWT claim `app_metadata.role` = admin
  - Bypasses for direct DB sessions with no JWT (migrations / superuser psql)
  - Otherwise raises an exception when any protected column would change

  ## Why JWT claims (not current_user)
  current_user inside a SECURITY DEFINER function resolves to the function
  owner (postgres), making any "current_user IN ('postgres', ...)" bypass
  unconditionally true. SECURITY INVOKER + JWT-based checks avoid this trap.
  app_metadata.role is signed by Supabase Auth and cannot be forged client-
  side, unlike profiles.role which is editable via the API path.

  ## Protected columns
  - id (immutable)
  - role, account_status, ban_reason, banned_until, banned_by (admin-only)
  - email (synced from auth.users)
  - stripe_account_id, stripe_customer_id, stripe_charges_enabled,
    stripe_payouts_enabled, stripe_onboarding_complete,
    stripe_onboarding_notified (managed by edge functions / webhook)

  ## Left writable by users
  username, display_name, photo_url, avatar_url, phone_number, location_data,
  bio, is_pro, siren_number, business_*, onboarding_completed.
*/

CREATE OR REPLACE FUNCTION public.prevent_protected_profile_update()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, auth, pg_temp
AS $$
DECLARE
  v_jwt jsonb;
  v_jwt_role text;
  v_app_role text;
BEGIN
  BEGIN
    v_jwt := current_setting('request.jwt.claims', true)::jsonb;
  EXCEPTION WHEN OTHERS THEN
    v_jwt := NULL;
  END;

  v_jwt_role := v_jwt ->> 'role';
  v_app_role := v_jwt #>> '{app_metadata,role}';

  -- No JWT context = direct DB access (migrations / superuser via psql).
  -- The PostgREST API path always carries claims, so this only matches
  -- privileged direct DB sessions, which we trust.
  IF v_jwt IS NULL THEN
    RETURN NEW;
  END IF;

  -- Service role (edge functions): the JWT has role=service_role.
  IF v_jwt_role = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Verified admin: app_metadata.role is signed by Supabase Auth and
  -- cannot be forged client-side.
  IF v_app_role = 'admin' THEN
    RETURN NEW;
  END IF;

  -- ---- Enforce immutability of sensitive columns for plain users ----

  IF NEW.id IS DISTINCT FROM OLD.id THEN
    RAISE EXCEPTION 'profiles.id is immutable';
  END IF;

  IF NEW.role IS DISTINCT FROM OLD.role THEN
    RAISE EXCEPTION 'profiles.role can only be changed by an administrator';
  END IF;

  IF NEW.account_status IS DISTINCT FROM OLD.account_status THEN
    RAISE EXCEPTION 'profiles.account_status can only be changed by an administrator';
  END IF;
  IF NEW.ban_reason IS DISTINCT FROM OLD.ban_reason THEN
    RAISE EXCEPTION 'profiles.ban_reason can only be changed by an administrator';
  END IF;
  IF NEW.banned_until IS DISTINCT FROM OLD.banned_until THEN
    RAISE EXCEPTION 'profiles.banned_until can only be changed by an administrator';
  END IF;
  IF NEW.banned_by IS DISTINCT FROM OLD.banned_by THEN
    RAISE EXCEPTION 'profiles.banned_by can only be changed by an administrator';
  END IF;

  IF NEW.email IS DISTINCT FROM OLD.email THEN
    RAISE EXCEPTION 'profiles.email is synced from auth.users and cannot be set directly';
  END IF;

  IF NEW.stripe_account_id IS DISTINCT FROM OLD.stripe_account_id THEN
    RAISE EXCEPTION 'profiles.stripe_account_id is managed by edge functions';
  END IF;
  IF NEW.stripe_customer_id IS DISTINCT FROM OLD.stripe_customer_id THEN
    RAISE EXCEPTION 'profiles.stripe_customer_id is managed by edge functions';
  END IF;
  IF NEW.stripe_charges_enabled IS DISTINCT FROM OLD.stripe_charges_enabled THEN
    RAISE EXCEPTION 'profiles.stripe_charges_enabled is managed by edge functions';
  END IF;
  IF NEW.stripe_payouts_enabled IS DISTINCT FROM OLD.stripe_payouts_enabled THEN
    RAISE EXCEPTION 'profiles.stripe_payouts_enabled is managed by edge functions';
  END IF;
  IF NEW.stripe_onboarding_complete IS DISTINCT FROM OLD.stripe_onboarding_complete THEN
    RAISE EXCEPTION 'profiles.stripe_onboarding_complete is managed by edge functions';
  END IF;
  IF NEW.stripe_onboarding_notified IS DISTINCT FROM OLD.stripe_onboarding_notified THEN
    RAISE EXCEPTION 'profiles.stripe_onboarding_notified is managed by edge functions';
  END IF;

  RETURN NEW;
END;
$$;

GRANT EXECUTE ON FUNCTION public.prevent_protected_profile_update()
  TO authenticated, anon, service_role;

DROP TRIGGER IF EXISTS profiles_prevent_protected_update ON public.profiles;

CREATE TRIGGER profiles_prevent_protected_update
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.prevent_protected_profile_update();
