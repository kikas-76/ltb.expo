/*
  # Add status to conversations table

  1. Changes
    - `conversations` table: add `status` column (text, default 'pending')
      - 'pending' = demande envoyée, en attente de réponse du propriétaire
      - 'accepted' = propriétaire a accepté
      - 'refused' = propriétaire a refusé

  2. Notes
    - Default is 'pending' so all existing conversations keep working
    - A check constraint ensures only valid values are stored
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'conversations' AND column_name = 'status'
  ) THEN
    ALTER TABLE conversations ADD COLUMN status text NOT NULL DEFAULT 'pending';
    ALTER TABLE conversations ADD CONSTRAINT conversations_status_check
      CHECK (status IN ('pending', 'accepted', 'refused'));
  END IF;
END $$;
