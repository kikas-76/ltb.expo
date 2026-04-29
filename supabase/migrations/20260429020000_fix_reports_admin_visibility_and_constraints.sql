/*
  # Fix the report system end to end

  Summary
  -------
  The reports flow had three independent breakages stacked on top of
  each other:

  1. **Admin SELECT was effectively impossible.** The
     "Users and admin can view reports" policy gated admins via
     `jwt.app_metadata.role = 'admin'`, but admin-ness on this app is
     stored in `profiles.role`, not in the JWT. So an admin loading
     the moderation queue only saw their *own* reports (the
     `auth.uid() = reporter_id` branch), not the ones filed by other
     users. Same broken pattern as the dispute admin policy
     (fixed in 20260428150000).

  2. **Status enum was out of sync between the RPC and the table.**
     The RPC `admin_update_report_status` validates
     `('pending','seen','rejected','resolved')`. The table CHECK
     allowed `('pending','reviewed','dismissed')`. So every "Marquer
     vu" / "Rejeter" click in the admin UI passed RPC validation and
     then failed the row-level CHECK on UPDATE. Status changes never
     persisted.

  3. **No category whitelist.** `app/report.tsx` submits one of eight
     keys; `category text NOT NULL` accepted anything. Garbage went
     in unchecked.

  Defense in depth: also add a partial UNIQUE index so the same user
  can't flood the queue with duplicate pending reports against the
  same target.
*/

-- 1. Status: replace the CHECK and migrate any pre-existing rows
--    (production currently has 0 rows; the UPDATEs are no-ops but
--    keep the migration safe to replay on a populated DB).
UPDATE public.reports SET status = 'seen'     WHERE status = 'reviewed';
UPDATE public.reports SET status = 'rejected' WHERE status = 'dismissed';

ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_status_check;
ALTER TABLE public.reports
  ADD CONSTRAINT reports_status_check
  CHECK (status IN ('pending', 'seen', 'rejected', 'resolved'));

-- 2. Category whitelist. Values must match the union of LISTING_CATEGORIES
--    and CONVERSATION_CATEGORIES in app/report.tsx — keep the two in sync
--    if either set evolves.
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_category_check;
ALTER TABLE public.reports
  ADD CONSTRAINT reports_category_check
  CHECK (category IN (
    'fraud',
    'inappropriate_content',
    'spam',
    'counterfeit',
    'dangerous',
    'harassment',
    'no_show',
    'other'
  ));

-- 3. RLS — fix admin visibility. Drop the JWT-based policies and
--    rebuild them on top of public.is_current_user_admin() (the same
--    helper already used elsewhere; reads profiles.role).
DROP POLICY IF EXISTS "Users and admin can view reports" ON public.reports;
DROP POLICY IF EXISTS "Admin update reports" ON public.reports;

CREATE POLICY "Reporter or admin can view reports"
  ON public.reports FOR SELECT
  TO authenticated
  USING (
    public.is_current_user_admin()
    OR (SELECT auth.uid()) = reporter_id
  );

CREATE POLICY "Admin can update reports"
  ON public.reports FOR UPDATE
  TO authenticated
  USING (public.is_current_user_admin())
  WITH CHECK (public.is_current_user_admin());

-- 4. De-dup pending reports. A reporter can still file again after the
--    first one is `seen` / `rejected` / `resolved`, but they can't
--    spam-stack identical pending entries on the same target.
DROP INDEX IF EXISTS reports_one_pending_per_reporter_target;
CREATE UNIQUE INDEX reports_one_pending_per_reporter_target
  ON public.reports (reporter_id, target_type, target_id)
  WHERE status = 'pending';
