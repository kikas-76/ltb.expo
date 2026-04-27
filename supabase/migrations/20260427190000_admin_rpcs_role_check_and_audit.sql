/*
  # Fix admin RPC role check + add audited status-update RPCs

  Background
  ----------
  Two issues found while auditing the admin dashboard:

  1. `admin_count_restricted_accounts` and `admin_get_profile_emails`
     gated access on `app_metadata.role` from the JWT, but the admin
     accounts in this project are flagged via `profiles.role = 'admin'`
     only — `raw_app_meta_data` is empty, so the JWT claim is null and
     the RPCs always raised `42501`. Both PostgREST swallowed it silently
     and the dashboard "Comptes restreints" metric (and dispute/report
     reporter-email hydration) returned nothing.

  2. `app/admin/disputes.tsx` and `app/admin/reports.tsx` updated the
     `status` column directly via PostgREST without writing anything to
     `admin_audit_logs`. Status changes therefore disappeared from the
     audit trail.

  Changes
  -------
  - Re-define the two existing RPCs to gate on `profiles.role` (the same
    pattern used by the new admin_list_users / admin_get_user_details).
    The protect_role_column trigger keeps non-admins from self-promoting,
    so this is as safe as the JWT check.
  - Add `admin_update_dispute_status(p_dispute_id, p_new_status)` and
    `admin_update_report_status(p_report_id, p_new_status)`. Both update
    the row in a transaction with an `admin_audit_logs` insert.
*/

CREATE OR REPLACE FUNCTION public.admin_count_restricted_accounts()
RETURNS bigint
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_caller_role text;
  v_count bigint;
BEGIN
  SELECT p.role INTO v_caller_role FROM public.profiles p WHERE p.id = auth.uid();
  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;

  SELECT count(*) INTO v_count
  FROM public.profiles
  WHERE account_status IN ('suspended', 'banned');

  RETURN v_count;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_profile_emails(p_ids uuid[])
RETURNS TABLE(id uuid, email text, username text)
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
DECLARE
  v_caller_role text;
BEGIN
  SELECT p.role INTO v_caller_role FROM public.profiles p WHERE p.id = auth.uid();
  IF v_caller_role IS DISTINCT FROM 'admin' THEN
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

CREATE OR REPLACE FUNCTION public.admin_update_dispute_status(
  p_dispute_id uuid,
  p_new_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_role text;
  v_old_status text;
BEGIN
  SELECT p.role INTO v_caller_role FROM public.profiles p WHERE p.id = v_caller;
  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;

  IF p_new_status NOT IN ('open','under_review','resolved','rejected') THEN
    RAISE EXCEPTION 'invalid dispute status: %', p_new_status USING ERRCODE = '22023';
  END IF;

  SELECT status INTO v_old_status FROM public.disputes WHERE id = p_dispute_id;
  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'dispute not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.disputes
  SET status = p_new_status, updated_at = now()
  WHERE id = p_dispute_id;

  INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (
    v_caller, 'dispute_status_change', 'dispute', p_dispute_id,
    jsonb_build_object('old_status', v_old_status, 'new_status', p_new_status)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_update_report_status(
  p_report_id uuid,
  p_new_status text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_caller_role text;
  v_old_status text;
BEGIN
  SELECT p.role INTO v_caller_role FROM public.profiles p WHERE p.id = v_caller;
  IF v_caller_role IS DISTINCT FROM 'admin' THEN
    RAISE EXCEPTION 'admin only' USING ERRCODE = '42501';
  END IF;

  IF p_new_status NOT IN ('pending','seen','rejected','resolved') THEN
    RAISE EXCEPTION 'invalid report status: %', p_new_status USING ERRCODE = '22023';
  END IF;

  SELECT status INTO v_old_status FROM public.reports WHERE id = p_report_id;
  IF v_old_status IS NULL THEN
    RAISE EXCEPTION 'report not found' USING ERRCODE = 'P0002';
  END IF;

  UPDATE public.reports
  SET status = p_new_status
  WHERE id = p_report_id;

  INSERT INTO public.admin_audit_logs (admin_id, action, target_type, target_id, details)
  VALUES (
    v_caller, 'report_status_change', 'report', p_report_id,
    jsonb_build_object('old_status', v_old_status, 'new_status', p_new_status)
  );
END;
$$;

REVOKE ALL ON FUNCTION public.admin_update_dispute_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_dispute_status(uuid, text) TO authenticated;
REVOKE ALL ON FUNCTION public.admin_update_report_status(uuid, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.admin_update_report_status(uuid, text) TO authenticated;
