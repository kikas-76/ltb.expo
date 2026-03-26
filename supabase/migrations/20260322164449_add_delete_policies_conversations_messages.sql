/*
  # Add DELETE policies for conversations and chat_messages

  Allows participants to delete conversations and their messages.

  1. conversations: participants (requester or owner) can delete
  2. chat_messages: participants can delete messages in their conversations
*/

CREATE POLICY "Participants can delete their conversations"
  ON conversations FOR DELETE TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = owner_id);

CREATE POLICY "Participants can delete chat messages"
  ON chat_messages FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM conversations c
      WHERE c.id = chat_messages.conversation_id
        AND (c.requester_id = auth.uid() OR c.owner_id = auth.uid())
    )
  );
