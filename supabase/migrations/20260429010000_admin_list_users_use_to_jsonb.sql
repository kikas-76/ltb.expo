/*
  # Fix admin_list_users — replace row_to_jsonb with to_jsonb

  Background
  ----------
  The original RPC (20260427170000_admin_list_users_rpc.sql) calls
  `row_to_jsonb(t)` to serialise each result row. On this Supabase
  instance (Postgres 17.6) the `row_to_jsonb` overload is not present
  in pg_catalog — only `to_jsonb(anyelement)` exists. So every call
  to admin_list_users raised:
      ERROR  42883  function row_to_jsonb(record) does not exist
  …and the admin Users page rendered with rows = [], total = 0.

  Fix
  ---
  Swap to `to_jsonb(t)`. Semantics are identical for a record argument
  in vanilla Postgres ≥ 9.5 (both wrap the row's column/value pairs
  into a JSON object), and `to_jsonb` is universally available, so the
  RPC is portable across Postgres builds.
*/

CREATE OR REPLACE FUNCTION public.admin_list_users(
  p_search text DEFAULT NULL,
  p_status text DEFAULT NULL,
  p_stripe_filter text DEFAULT NULL,
  p_limit integer DEFAULT 20,
  p_offset integer DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
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

  SELECT COALESCE(jsonb_agg(to_jsonb(t)), '[]'::jsonb) INTO v_rows
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
