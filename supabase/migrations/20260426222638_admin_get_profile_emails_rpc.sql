/*
  # admin_get_profile_emails(p_ids uuid[])

  Returns (id, email, username) for the requested profiles, gated to
  admins (app_metadata.role = 'admin' from the signed JWT).

  After 20260426160000_tighten_profiles_visibility revoked SELECT(email)
  from authenticated, the admin pages that previously embedded
  `profiles!fkey(... email)` failed with permission_denied even for
  legitimate admins. Those pages now fetch usernames via the FK join
  and resolve emails through this RPC.

  Pages migrated:
    app/admin/disputes.tsx
    app/admin/reports.tsx
    app/admin/transactions.tsx
    app/admin/analytics.tsx (CSV export — email columns dropped, only username kept)
*/

CREATE OR REPLACE FUNCTION public.admin_get_profile_emails(p_ids uuid[])
RETURNS TABLE (id uuid, email text, username text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_app_role text;
BEGIN
  v_app_role := (current_setting('request.jwt.claims', true)::jsonb #>> '{app_metadata,role}');
  IF v_app_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;

  IF p_ids IS NULL OR cardinality(p_ids) = 0 THEN
    RETURN;
  END IF;

  RETURN QUERY
    SELECT p.id, p.email, p.username
      FROM public.profiles p
     WHERE p.id = ANY (p_ids);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_get_profile_emails(uuid[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_get_profile_emails(uuid[]) TO authenticated;
