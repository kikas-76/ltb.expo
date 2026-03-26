/*
  # Add is_read column to chat_messages

  ## Changes
  - Adds `is_read` boolean column (default false) to `chat_messages` table
    so the app can track which messages have been read by the recipient.

  ## Notes
  - Existing messages are marked as read (true) by default to avoid false notifications
    for historical conversations.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'chat_messages' AND column_name = 'is_read'
  ) THEN
    ALTER TABLE chat_messages ADD COLUMN is_read boolean DEFAULT false NOT NULL;
    UPDATE chat_messages SET is_read = true;
  END IF;
END $$;
