/*
  # Admin RPC to list profiles with full sensitive columns

  Background
  ----------
  Earlier hardening migrations (20260415221106_profiles_column_level_security,
  20260426202603_tighten_profiles_visibility) revoked SELECT on
  profiles.email / role / account_status / stripe_charges_enabled from the
  authenticated role at the column level. The /admin/users page selected
  those columns directly and PostgREST started returning a permission error
  silently — the page rendered "0 utilisateurs" for every admin.

  Fix
  ---
  Add a SECURITY DEFINER RPC that returns the page rows + total count as a
  single JSONB payload. Access is gated on profiles.role = 'admin' rather
  than the JWT app_metadata.role used by the older admin RPCs, because admin
  flagging in this project lives only on profiles.role (raw_app_meta_data is
  empty for the existing admin accounts). profiles.role itself is protected
  against self-promotion by the protect_role_column trigger
  (20260415224602).

  Filters supported:
    - p_search: ILIKE on username/email
    - p_status: account_status equality (e.g. 'active', 'suspended', 'banned')
    - p_stripe_filter: 'validated' (charges_enabled IS TRUE) or 'unvalidated'
      (NULL or FALSE).
*/

CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_stripe_filter text DEFAULT NULL,
  p_limit int DEFAULT 20,
  p_offset int DEFAULT 0
) RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller_role text;
  v_total bigint;
  v_rows jsonb;
BEGIN
  SELECT p.role INTO v_caller_role FROM public.profiles p WHERE p.id = auth.uid();
  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;

  SELECT COUNT(*)::bigint INTO v_total
  FROM public.profiles p
  WHERE (p_status IS NULL OR p.account_status = p_status)
    AND (
      p_stripe_filter IS NULL
      OR (p_stripe_filter = 'validated' AND p.stripe_charges_enabled IS TRUE)
      OR (p_stripe_filter = 'unvalidated' AND COALESCE(p.stripe_charges_enabled, false) = false)
    )
    AND (
      p_search IS NULL OR p_search = ''
      OR p.username ILIKE '%' || p_search || '%'
      OR p.email    ILIKE '%' || p_search || '%'
    );

  SELECT COALESCE(jsonb_agg(row_to_jsonb(t)), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT p.id, p.username, p.email, p.is_pro, p.role,
           p.account_status, p.stripe_charges_enabled, p.created_at
    FROM public.profiles p
    WHERE (p_status IS NULL OR p.account_status = p_status)
      AND (
        p_stripe_filter IS NULL
        OR (p_stripe_filter = 'validated' AND p.stripe_charges_enabled IS TRUE)
        OR (p_stripe_filter = 'unvalidated' AND COALESCE(p.stripe_charges_enabled, false) = false)
      )
      AND (
        p_search IS NULL OR p_search = ''
        OR p.username ILIKE '%' || p_search || '%'
        OR p.email    ILIKE '%' || p_search || '%'
      )
    ORDER BY p.created_at DESC
    LIMIT GREATEST(p_limit, 0) OFFSET GREATEST(p_offset, 0)
  ) t;

  RETURN jsonb_build_object('rows', v_rows, 'total', v_total);
END;
$$;

REVOKE ALL ON FUNCTION public.admin_list_users(text, text, text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_list_users(text, text, text, int, int) TO authenticated;
