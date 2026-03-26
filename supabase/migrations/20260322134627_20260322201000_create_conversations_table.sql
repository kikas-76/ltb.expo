/*
  # Create conversations table

  Stores rental request conversations between a requester and an owner,
  linked to a specific listing with the requested date range.
*/

CREATE TABLE IF NOT EXISTS conversations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  listing_id uuid REFERENCES listings(id) ON DELETE SET NULL,
  requester_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  owner_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  start_date date NOT NULL,
  end_date date NOT NULL,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE conversations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Participants can view their conversations"
  ON conversations FOR SELECT TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = owner_id);

CREATE POLICY "Requester can create a conversation"
  ON conversations FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE INDEX IF NOT EXISTS conversations_requester_id_idx ON conversations(requester_id);
CREATE INDEX IF NOT EXISTS conversations_owner_id_idx ON conversations(owner_id);
