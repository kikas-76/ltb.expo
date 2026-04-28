/*
  # Fix admin audit-trail policies, add audit-query RPC, lock chat immutability

  Background
  ----------
  Three findings from the 2026-04-28 auth/RLS audit:

  1. `admin_audit_logs` and `user_account_events` policies still gate on
     `auth.jwt() -> 'app_metadata' ->> 'role' = 'admin'`. Production admins
     are flagged via `profiles.role = 'admin'` only — `raw_app_meta_data`
     is empty — so admins can neither SELECT nor INSERT directly. The
     original recursion concern (which motivated the JWT check on
     profiles itself) does not apply here: querying `profiles` from a
     policy on a different table does not recurse.

     Fix by using a SECURITY DEFINER helper `is_current_user_admin()`
     that reads `profiles.role` once. The protect_role_column trigger
     keeps non-admins from self-promoting, so this check is as safe as
     the JWT one.

  2. No way for admins to query the audit trail. Add
     `admin_query_audit_logs(p_limit, p_offset, p_action)` RPC that gates
     on the same helper.

  3. `conversations` and `chat_messages` have no explicit DELETE policy.
     PostgreSQL denies-by-default with RLS enabled so this is safe today,
     but the implicit deny is fragile — a future migration that adds an
     unrelated FOR ALL policy could silently grant deletes. Add explicit
     `FOR DELETE USING (false)` policies to document immutability.
*/

-- 1. Helper: is the current authenticated user an admin?
-- SECURITY DEFINER avoids recursion when called from a policy that's
-- evaluated during a SELECT on profiles itself (we don't use it on
-- profiles, but the pattern keeps future use safe).
CREATE OR REPLACE FUNCTION public.is_current_user_admin()
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

REVOKE ALL ON FUNCTION public.is_current_user_admin() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_current_user_admin() TO authenticated, service_role;

-- 2. admin_audit_logs: replace JWT-based policies with helper-based ones
DROP POLICY IF EXISTS "Admins can read audit logs" ON public.admin_audit_logs;
DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.admin_audit_logs;

CREATE POLICY "Admins can read audit logs"
  ON public.admin_audit_logs FOR SELECT
  TO authenticated
  USING (public.is_current_user_admin());

CREATE POLICY "Admins can insert audit logs"
  ON public.admin_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (public.is_current_user_admin());

-- 3. user_account_events: same fix, keep "users read own"
DROP POLICY IF EXISTS "Admins can read all account events" ON public.user_account_events;
DROP POLICY IF EXISTS "Admins can insert account events" ON public.user_account_events;

CREATE POLICY "Admins can read all account events"
  ON public.user_account_events FOR SELECT
  TO authenticated
  USING (public.is_current_user_admin());

CREATE POLICY "Admins can insert account events"
  ON public.user_account_events FOR INSERT
  TO authenticated
  WITH CHECK (public.is_current_user_admin());

-- 4. RPC for admins to page through the audit trail
CREATE OR REPLACE FUNCTION public.admin_query_audit_logs(
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0,
  p_action text DEFAULT NULL,
  p_target_type text DEFAULT NULL
)
RETURNS TABLE (
  id uuid,
  admin_id uuid,
  admin_username text,
  action text,
  target_type text,
  target_id uuid,
  details jsonb,
  ip_address text,
  created_at timestamptz
)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.is_current_user_admin() THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;

  IF p_limit IS NULL OR p_limit < 1 THEN p_limit := 50; END IF;
  IF p_limit > 500 THEN p_limit := 500; END IF;
  IF p_offset IS NULL OR p_offset < 0 THEN p_offset := 0; END IF;

  RETURN QUERY
    SELECT
      l.id,
      l.admin_id,
      p.username AS admin_username,
      l.action,
      l.target_type,
      l.target_id,
      l.details,
      l.ip_address,
      l.created_at
    FROM public.admin_audit_logs l
    LEFT JOIN public.profiles p ON p.id = l.admin_id
    WHERE (p_action IS NULL OR l.action = p_action)
      AND (p_target_type IS NULL OR l.target_type = p_target_type)
    ORDER BY l.created_at DESC
    LIMIT p_limit
    OFFSET p_offset;
END;
$$;

REVOKE ALL ON FUNCTION public.admin_query_audit_logs(int, int, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_query_audit_logs(int, int, text, text) TO authenticated;

-- 5. Document immutability of conversations and chat_messages
-- DELETE is already denied by default (no policy = deny under RLS), but
-- making it explicit prevents a future FOR ALL policy from silently
-- opening it up.
DROP POLICY IF EXISTS "Conversations are immutable (no client delete)" ON public.conversations;
CREATE POLICY "Conversations are immutable (no client delete)"
  ON public.conversations FOR DELETE
  TO authenticated, anon
  USING (false);

DROP POLICY IF EXISTS "Chat messages are immutable (no client delete)" ON public.chat_messages;
CREATE POLICY "Chat messages are immutable (no client delete)"
  ON public.chat_messages FOR DELETE
  TO authenticated, anon
  USING (false);
