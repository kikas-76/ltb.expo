-- The "Chat messages are immutable (no client delete)" policy from 20260428100000
-- is PERMISSIVE, so it was OR-ed with this older policy and blocked nothing: any
-- participant could delete any message of their conversation. The app never
-- deletes individual messages; deleting a conversation cascades through the FK.
DROP POLICY IF EXISTS "Participants can delete chat messages" ON public.chat_messages;
