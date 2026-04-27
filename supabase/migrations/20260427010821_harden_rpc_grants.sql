/*
  # Harden RPC grants (audit P1 #5)

  Postgres grants EXECUTE to PUBLIC by default for new functions, and the
  earlier migrations only added explicit GRANT TO authenticated without
  pairing it with REVOKE FROM PUBLIC. Result: anon could call every
  custom RPC, including the rate-limit helper meant for edge functions.

  This migration narrows EXECUTE on every custom RPC by audience:

  - service_role only: check_rate_limit (only invoked by edge functions).
  - authenticated only: the user-facing RPCs that already do their own
    auth checks internally (auth.uid() / app_metadata.role). Defense in
    depth removes anon as a usable starting point.
  - SECURITY DEFINER triggers (prevent_role_self_update, handle_new_user)
    do not need to be EXECUTE-able by API roles at all — Postgres invokes
    them as the function owner.
  - SECURITY INVOKER triggers (prevent_protected_profile_update,
    fn_*_count helpers) are deliberately left wide open: the trigger
    fires under the caller's grants, so revoking authenticated would
    break every UPDATE/INSERT that fires the trigger.

  Verified via has_function_privilege after deploy:

    fn                                      anon  auth  svc
    --------------------------------------  ----  ----  ---
    admin_count_restricted_accounts         no    yes   yes
    admin_get_profile_emails                no    yes   yes
    check_rate_limit                        no    no    yes
    create_booking_for_payment              no    yes   yes
    get_my_profile                          no    yes   yes
    get_nearby_listings                     no    yes   yes
    update_booking_status                   no    yes   yes
    handle_new_user                         no    no    yes  (DEFINER trigger)
    prevent_role_self_update                no    no    yes  (DEFINER trigger)
    prevent_protected_profile_update        yes   yes   yes  (INVOKER trigger, intentional)
    fn_increment_views_count                yes   yes   yes  (INVOKER trigger, intentional)
*/

REVOKE EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) FROM PUBLIC, anon, authenticated;
GRANT  EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer) TO service_role;

REVOKE EXECUTE ON FUNCTION public.admin_count_restricted_accounts() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.admin_get_profile_emails(uuid[]) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.create_booking_for_payment(uuid, date, date, uuid) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_my_profile() FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.update_booking_status(uuid, text, jsonb) FROM PUBLIC, anon;
REVOKE EXECUTE ON FUNCTION public.get_nearby_listings(double precision, double precision, double precision, integer, integer) FROM PUBLIC, anon;

REVOKE EXECUTE ON FUNCTION public.prevent_role_self_update() FROM PUBLIC, anon, authenticated;
REVOKE EXECUTE ON FUNCTION public.handle_new_user() FROM PUBLIC, anon, authenticated;
