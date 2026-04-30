/*
  # Lock conversation deletion to terminal states only

  The participant-can-delete RLS lets either side of a conversation
  call DELETE; we relied on the client UI to decide *when* deletion
  was appropriate. That's flimsy:

   - A curl from a malicious or buggy client could DELETE an
     `accepted` conversation that has a paid `active` booking,
     orphaning the booking row (FK is ON DELETE SET NULL → booking
     stays but loses its conversation context).
   - The "Conversations are immutable (no client delete)" policy
     was permissive USING (false) — wrapped together with the
     participants policy, RLS evaluated `false OR participant` →
     participant always wins. Misleading, makes the policy table
     read like deletes are blocked when in fact they aren't.

  Two-layer fix:

  1. Drop the misleading immutable-conversations policy. The remaining
     "Participants can delete their conversations" policy stays as the
     row-level access gate (you can only delete a row you're part of).

  2. Add a BEFORE DELETE trigger that enforces the *state* gate:
     conversation must be in a terminal state (refused / cancelled /
     expired) AND the latest associated booking, if any, must also be
     terminal (completed / cancelled / refused / expired). Anything
     in flight raises 42501 with a readable French message that the
     UI surfaces back to the user. service_role bypasses (admin and
     cron jobs need to be able to clean up regardless).

  The same rule lives in app/(tabs)/reservations.tsx
  (`canDeleteConversation`); this migration is the authoritative
  copy — UI and DB stay in sync.
*/

DROP POLICY IF EXISTS "Conversations are immutable (no client delete)" ON public.conversations;

CREATE OR REPLACE FUNCTION public.guard_conversation_delete()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_latest_booking_status text;
BEGIN
  -- service_role and admins (via SECURITY DEFINER helpers) keep full
  -- delete rights — needed for moderation tooling, RGPD wipes, etc.
  IF auth.role() = 'service_role' THEN
    RETURN OLD;
  END IF;

  -- Conversation status must be terminal.
  IF OLD.status NOT IN ('refused', 'cancelled', 'expired') THEN
    RAISE EXCEPTION 'Cette conversation est encore active (statut %), suppression impossible.', OLD.status
      USING ERRCODE = '42501';
  END IF;

  -- If a booking is attached, it must also be terminal — disputed /
  -- pending_payment / active / in_progress / pending_return /
  -- pending_owner_validation are all still in flight and tied to live
  -- money or coordination. We pick the latest booking on the
  -- conversation: an old cancelled booking + a new disputed one (e.g.
  -- after a re-accept) should still block the delete.
  SELECT status INTO v_latest_booking_status
    FROM public.bookings
   WHERE conversation_id = OLD.id
   ORDER BY created_at DESC
   LIMIT 1;

  IF v_latest_booking_status IS NOT NULL
     AND v_latest_booking_status NOT IN ('completed', 'cancelled', 'refused', 'expired') THEN
    RAISE EXCEPTION 'La réservation associée est encore active (statut %), suppression impossible.', v_latest_booking_status
      USING ERRCODE = '42501';
  END IF;

  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS guard_conversation_delete_trg ON public.conversations;
CREATE TRIGGER guard_conversation_delete_trg
  BEFORE DELETE ON public.conversations
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_conversation_delete();
