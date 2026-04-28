/*
  # Forbid is_system=true on participant-initiated chat_messages INSERT

  Background
  ----------
  The "Participants can send chat messages" policy from migration
  20260411214148 enforces sender_id = auth.uid() and a participant
  check, but does NOT constrain `is_system`. A malicious participant
  can therefore insert a message with `is_system = true`, faking a
  server-issued system notice in the conversation UI.

  Migration 20260415220823 already dropped the older "System chat
  messages by participants" policy that allowed `sender_id = NULL`
  inserts; system messages are meant to be inserted only by Edge
  Functions via service_role (which bypasses RLS).

  This migration closes the remaining gap: even with sender_id pinned
  to the caller, is_system must be false on participant inserts.

  Service role still bypasses RLS, so post-system-message and other
  Edge Functions keep inserting `is_system = true` rows unaffected.
*/

DROP POLICY IF EXISTS "Participants can send chat messages" ON public.chat_messages;

CREATE POLICY "Participants can send chat messages"
  ON public.chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (
    (select auth.uid()) = sender_id
    AND coalesce(is_system, false) = false
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = chat_messages.conversation_id
        AND (c.requester_id = (select auth.uid()) OR c.owner_id = (select auth.uid()))
    )
  );
