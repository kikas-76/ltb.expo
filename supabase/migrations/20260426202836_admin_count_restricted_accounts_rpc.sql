/*
  # admin_count_restricted_accounts()

  Returns the count of profiles whose account_status is suspended or banned.
  After 20260426160000_tighten_profiles_visibility, account_status is
  revoked for anon/authenticated, so the admin dashboard must go through
  this SECURITY DEFINER RPC.

  Caller must have app_metadata.role = 'admin' (verified server-side via
  the JWT claim, which is signed by Supabase Auth and not forgeable).
*/

CREATE OR REPLACE FUNCTION public.admin_count_restricted_accounts()
RETURNS bigint
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_app_role text;
  v_count bigint;
BEGIN
  v_app_role := (current_setting('request.jwt.claims', true)::jsonb #>> '{app_metadata,role}');
  IF v_app_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.profiles
  WHERE account_status IN ('suspended', 'banned');

  RETURN v_count;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_count_restricted_accounts() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_count_restricted_accounts() TO authenticated;
