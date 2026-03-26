/*
  # Add UPDATE policy for conversation owner to change status

  ## Change
  - Adds a new RLS policy allowing the owner of a conversation to update
    the status column (to accept or refuse a request).

  ## Security
  - Only the owner (not the requester) can update a conversation.
  - The owner is identified via auth.uid() = owner_id.
*/

CREATE POLICY "Owner can update conversation status"
  ON conversations
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = owner_id)
  WITH CHECK (auth.uid() = owner_id);
