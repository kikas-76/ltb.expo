/*
  # RLS policies and index for chat_messages
*/

CREATE POLICY "Participants can view chat messages"
  ON chat_messages FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = chat_messages.conversation_id
        AND (c.requester_id = auth.uid() OR c.owner_id = auth.uid())
    )
  );

CREATE POLICY "Participants can send chat messages"
  ON chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    auth.uid() = sender_id
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = chat_messages.conversation_id
        AND (c.requester_id = auth.uid() OR c.owner_id = auth.uid())
    )
  );

CREATE POLICY "System chat messages by participants"
  ON chat_messages FOR INSERT TO authenticated
  WITH CHECK (
    is_system = true
    AND sender_id IS NULL
    AND EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = chat_messages.conversation_id
        AND (c.requester_id = auth.uid() OR c.owner_id = auth.uid())
    )
  );

CREATE INDEX IF NOT EXISTS chat_messages_conversation_id_idx ON chat_messages(conversation_id);
