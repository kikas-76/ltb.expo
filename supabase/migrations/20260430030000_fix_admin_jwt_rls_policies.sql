/*
  # Migrate admin RLS gates from JWT app_metadata to profiles.role

  Same root cause as the reports RLS bug fixed in 20260429020000:
  six SELECT/UPDATE policies still gate admins via
  `jwt.app_metadata.role = 'admin'`, but admin-ness on this app lives
  in `profiles.role`, not in the JWT. So every direct `select()` an
  admin runs against these tables only returns rows where the admin is
  *personally* a participant — not the global view the admin dashboard
  expects.

  Concrete fallout we hit:
   - admin/IndexScreen counts (active bookings, open disputes,
     monthly revenue, recent bookings list) reflect just the admin's
     own activity.
   - admin/AnalyticsScreen revenue / dispute charts are similarly
     filtered.
   - admin/TransactionsScreen lists only the admin's own bookings.
   - listing visibility: admins can't see deactivated listings they
     don't own. Same broken branch on `Listings visible par
     authenticated`.

  All six policies are rewritten to use `is_current_user_admin()` —
  the SECURITY DEFINER helper that reads `profiles.role`. The
  participant-side branches (auth.uid() = renter_id / owner_id /
  reporter_id, plus the disputes booking-participants subselect) are
  preserved verbatim.

  Note: the admin SECURITY DEFINER RPCs (admin_list_users,
  admin_get_user_details, admin_update_*) bypass RLS entirely, so
  workflows already routed through them keep working untouched. This
  migration only restores the direct-select admin paths.
*/

-- 1. listings — SELECT
DROP POLICY IF EXISTS "Listings visible par authenticated" ON public.listings;
CREATE POLICY "Listings visible par authenticated"
  ON public.listings FOR SELECT
  TO authenticated
  USING (
    is_active = true
    OR (SELECT auth.uid()) = owner_id
    OR public.is_current_user_admin()
  );

-- 2. bookings — SELECT
DROP POLICY IF EXISTS "Renter owner and admin can view bookings" ON public.bookings;
CREATE POLICY "Renter owner and admin can view bookings"
  ON public.bookings FOR SELECT
  TO authenticated
  USING (
    public.is_current_user_admin()
    OR (SELECT auth.uid()) = renter_id
    OR (SELECT auth.uid()) = owner_id
  );

-- 3. conversations — SELECT
DROP POLICY IF EXISTS "Participants and admin can view conversations" ON public.conversations;
CREATE POLICY "Participants and admin can view conversations"
  ON public.conversations FOR SELECT
  TO authenticated
  USING (
    public.is_current_user_admin()
    OR (SELECT auth.uid()) = requester_id
    OR (SELECT auth.uid()) = owner_id
  );

-- 4. disputes — SELECT (preserve the booking-participant subselect)
DROP POLICY IF EXISTS "Users and admin can view disputes" ON public.disputes;
CREATE POLICY "Users and admin can view disputes"
  ON public.disputes FOR SELECT
  TO authenticated
  USING (
    public.is_current_user_admin()
    OR (SELECT auth.uid()) = reporter_id
    OR EXISTS (
      SELECT 1
        FROM public.bookings b
       WHERE b.id = disputes.booking_id
         AND ((SELECT auth.uid()) IN (b.renter_id, b.owner_id))
    )
  );

-- 5. disputes — UPDATE
-- (admin path was JWT-based; keep reporter-author write so users
--  can still attach detail/photos to their own row.)
DROP POLICY IF EXISTS "Reporter and admin can update disputes" ON public.disputes;
CREATE POLICY "Reporter and admin can update disputes"
  ON public.disputes FOR UPDATE
  TO authenticated
  USING (
    public.is_current_user_admin()
    OR (SELECT auth.uid()) = reporter_id
  )
  WITH CHECK (
    public.is_current_user_admin()
    OR (SELECT auth.uid()) = reporter_id
  );

-- 6. user_account_events — SELECT
DROP POLICY IF EXISTS "Users and admin can read account events" ON public.user_account_events;
CREATE POLICY "Users and admin can read account events"
  ON public.user_account_events FOR SELECT
  TO authenticated
  USING (
    public.is_current_user_admin()
    OR (SELECT auth.uid()) = user_id
  );
