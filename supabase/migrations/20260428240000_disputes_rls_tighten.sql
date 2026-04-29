/*
  # Tighten disputes RLS — participant-only INSERT, column-scoped UPDATE
  (audit P2 — dispute flow abuse vectors)

  Background
  ----------
  The original disputes policies (migration 20260403120645) had two gaps:

  1. INSERT WITH CHECK only verified `auth.uid() = reporter_id`. Any
     authenticated user could spawn a dispute row pointing at any
     booking_id (including bookings they had no relationship to). The
     update_booking_status RPC blocks the booking from actually
     transitioning to 'disputed', so this was a pollution / spam
     vector rather than a status-tampering one — but `chat-notify
     event=dispute_opened` walks the booking participants and emails
     them, turning a stranger's dispute insert into harassment.

  2. UPDATE policy was full-row, gated only on `auth.uid() = reporter_id`.
     The reporter could `update({ status: 'resolved' })` to mask a
     legitimate dispute they themselves opened, or escalate to fake
     'under_review' to game admin queues.

  Fixes
  -----
  - Replace the INSERT policy with one that requires the reporter to
    be a participant of the booking AND for the booking to be in a
    state where a dispute makes sense (`in_progress`,
    `pending_owner_validation`, `disputed`).
  - Replace the UPDATE policy: keep reporter authorship as the gate,
    but use column-level GRANT to restrict the columns reporters can
    write. `status` and the FK columns become service-role / admin
    only. Two-layer defense — the GRANT is the authoritative gate,
    the policy keeps row-level scoping.

  Admins still write `status` through edge functions / admin RPCs
  using the service role.
*/

-- 1. Drop old policies
DROP POLICY IF EXISTS "Reporter can insert own dispute" ON public.disputes;
DROP POLICY IF EXISTS "Reporter can update own dispute" ON public.disputes;

-- 2. INSERT: reporter must be a participant of the booking, and the
--    booking must be in a state where opening a dispute is meaningful.
CREATE POLICY "Booking participant can insert dispute"
  ON public.disputes FOR INSERT
  TO authenticated
  WITH CHECK (
    auth.uid() = reporter_id
    AND EXISTS (
      SELECT 1
        FROM public.bookings b
       WHERE b.id = disputes.booking_id
         AND (b.owner_id = auth.uid() OR b.renter_id = auth.uid())
         AND b.status IN ('in_progress', 'pending_owner_validation', 'disputed')
    )
  );

-- 3. UPDATE: keep "reporter writes their own row" at the row level.
--    Column-level grants (below) prevent the reporter from changing
--    status, booking_id, conversation_id, reporter_id, timestamps.
CREATE POLICY "Reporter can update own dispute fields"
  ON public.disputes FOR UPDATE
  TO authenticated
  USING (auth.uid() = reporter_id)
  WITH CHECK (auth.uid() = reporter_id);

-- 4. Column-level UPDATE grants. Revoke first to clear any inherited
--    table-level grant, then re-grant the safe subset.
REVOKE UPDATE ON public.disputes FROM authenticated, anon;
GRANT UPDATE (description, photo_urls) ON public.disputes TO authenticated;

-- service_role keeps full UPDATE rights via the role's BYPASSRLS
-- privilege; no extra grant needed for edge functions.

-- INSERT and SELECT grants are unchanged — Supabase's default grants
-- to authenticated already cover them and the RLS policies above gate
-- the actual access.
