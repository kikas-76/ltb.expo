/*
  # Allow `cancelled` (and `expired`) on conversations.status

  Background
  ----------
  The original conversations.status CHECK only accepts
  `pending | accepted | refused`. But the
  expire-stale-pending-payments cron does

      update conversations set status='cancelled'
       where id = ?  and status='accepted';

  …which silently 23514s against the check, leaving the conversation
  stuck on 'accepted' while the booking row is correctly flipped to
  'cancelled'. UI sees a zombie pair: an accepted conversation with no
  payable booking attached. Same shape on the Reservations list — the
  trash icon never lights up because conv.status isn't a terminal one.

  The TS layer (app/(tabs)/reservations.tsx) already types
  conv.status as 'pending' | 'accepted' | 'refused' | 'cancelled', so
  client code is ready for the wider set; only the DB CHECK was
  lagging.

  Fix
  ---
  - Extend the CHECK to include 'cancelled' and 'expired' so the cron
    write succeeds. 'expired' is added prophylactically for the same
    pattern on stale `pending` requests (expire_stale_conversations
    currently flips them to `refused`, but a future split between
    "owner refused" and "auto-expired" should not require another
    schema migration).
  - Backfill any conversation whose latest booking is `cancelled` /
    `expired` so the UI no longer shows them as accepted.
*/

ALTER TABLE public.conversations
  DROP CONSTRAINT IF EXISTS conversations_status_check;

ALTER TABLE public.conversations
  ADD CONSTRAINT conversations_status_check
  CHECK (status IN ('pending', 'accepted', 'refused', 'cancelled', 'expired'));

-- Backfill: conversations marked accepted whose latest booking is
-- terminal — flip them to match. Limits to the most recent booking
-- per conversation in case multiple exist (re-accept after auto-expiry).
WITH latest AS (
  SELECT DISTINCT ON (b.conversation_id)
         b.conversation_id, b.status
    FROM public.bookings b
   WHERE b.conversation_id IS NOT NULL
   ORDER BY b.conversation_id, b.created_at DESC
)
UPDATE public.conversations c
   SET status = 'cancelled'
  FROM latest
 WHERE c.id = latest.conversation_id
   AND c.status = 'accepted'
   AND latest.status IN ('cancelled', 'expired');
