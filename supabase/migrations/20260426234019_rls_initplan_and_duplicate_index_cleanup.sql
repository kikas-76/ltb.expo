/*
  # P2-2 — RLS performance + duplicate indexes

  Two batches:

  1. auth_rls_initplan WARN ×13. Existing policies wrap `auth.uid()` in
     `(SELECT auth.uid())` correctly, but the JWT-based admin checks were
     written `(SELECT auth.jwt() -> 'app_metadata' ->> 'role')` — the
     SELECT covers the whole JSON walk, not the function call. The
     Supabase advisor wants the function alone in the subquery so the
     value is computed once per statement, not once per row.

     Recreating each policy with the canonical pattern
       `((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'`
     and similarly preserving the `(SELECT auth.uid())` wraps already in
     place. Tables touched: admin_audit_logs, user_account_events,
     listings, notifications, bookings, conversations, reports, disputes.

  2. duplicate_index WARN ×2 on listing_views and listings. Same column
     covered twice. Kept the explicit `idx_*` names, dropped the
     auto-generated `<table>_<col>_idx` ones.

  Verified by re-running supabase get_advisors performance: those 15
  WARN lints no longer appear. Remaining advisors are all `unused_index`
  INFO — keeping them in place because prelaunch traffic is too thin
  to make a delete decision; revisit after production telemetry catches
  up.
*/

-- ============================================================
-- 1. RLS policies: rewrap auth.jwt() / auth.uid() canonically
-- ============================================================

DROP POLICY IF EXISTS "Admins can insert audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins can insert audit logs"
  ON public.admin_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins can read audit logs" ON public.admin_audit_logs;
CREATE POLICY "Admins can read audit logs"
  ON public.admin_audit_logs FOR SELECT
  TO authenticated
  USING (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admins can insert account events" ON public.user_account_events;
CREATE POLICY "Admins can insert account events"
  ON public.user_account_events FOR INSERT
  TO authenticated
  WITH CHECK (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Users and admin can read account events" ON public.user_account_events;
CREATE POLICY "Users and admin can read account events"
  ON public.user_account_events FOR SELECT
  TO authenticated
  USING (
    ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
    OR (SELECT auth.uid()) = user_id
  );

DROP POLICY IF EXISTS "Listings visible par authenticated" ON public.listings;
CREATE POLICY "Listings visible par authenticated"
  ON public.listings FOR SELECT
  TO authenticated
  USING (
    is_active = true
    OR (SELECT auth.uid()) = owner_id
    OR ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
  );

DROP POLICY IF EXISTS "Admin can insert notifications" ON public.notifications;
CREATE POLICY "Admin can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Admin update bookings" ON public.bookings;
CREATE POLICY "Admin update bookings"
  ON public.bookings FOR UPDATE
  TO authenticated
  USING (
    ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
    OR (SELECT auth.uid()) = renter_id
    OR (SELECT auth.uid()) = owner_id
  )
  WITH CHECK (
    ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
    OR (SELECT auth.uid()) = renter_id
    OR (SELECT auth.uid()) = owner_id
  );

DROP POLICY IF EXISTS "Renter owner and admin can view bookings" ON public.bookings;
CREATE POLICY "Renter owner and admin can view bookings"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (
    ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
    OR (SELECT auth.uid()) = renter_id
    OR (SELECT auth.uid()) = owner_id
  );

DROP POLICY IF EXISTS "Participants and admin can view conversations" ON public.conversations;
CREATE POLICY "Participants and admin can view conversations"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (
    ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
    OR (SELECT auth.uid()) = requester_id
    OR (SELECT auth.uid()) = owner_id
  );

DROP POLICY IF EXISTS "Admin update reports" ON public.reports;
CREATE POLICY "Admin update reports"
  ON public.reports FOR UPDATE
  TO authenticated
  USING (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin')
  WITH CHECK (((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin');

DROP POLICY IF EXISTS "Users and admin can view reports" ON public.reports;
CREATE POLICY "Users and admin can view reports"
  ON public.reports FOR SELECT
  TO authenticated
  USING (
    ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
    OR (SELECT auth.uid()) = reporter_id
  );

DROP POLICY IF EXISTS "Reporter and admin can update disputes" ON public.disputes;
CREATE POLICY "Reporter and admin can update disputes"
  ON public.disputes FOR UPDATE
  TO authenticated
  USING (
    ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
    OR (SELECT auth.uid()) = reporter_id
  )
  WITH CHECK (
    ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
    OR (SELECT auth.uid()) = reporter_id
  );

DROP POLICY IF EXISTS "Users and admin can view disputes" ON public.disputes;
CREATE POLICY "Users and admin can view disputes"
  ON public.disputes FOR SELECT
  TO authenticated
  USING (
    ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
    OR (SELECT auth.uid()) = reporter_id
    OR EXISTS (
      SELECT 1 FROM public.bookings
      WHERE bookings.id = disputes.booking_id
        AND (
          bookings.renter_id = (SELECT auth.uid())
          OR bookings.owner_id = (SELECT auth.uid())
        )
    )
  );

-- ============================================================
-- 2. Drop duplicate indexes
-- ============================================================

DROP INDEX IF EXISTS public.listing_views_listing_id_idx;
DROP INDEX IF EXISTS public.listings_owner_id_idx;
