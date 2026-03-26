/*
  # Create reports table

  ## Summary
  Allows users to report listings or conversations with a category, optional description, and status tracking.

  ## New Tables
  - `reports`
    - `id` (uuid, PK)
    - `reporter_id` (uuid, FK → auth.users)
    - `target_type` (text) — 'listing' or 'conversation'
    - `target_id` (uuid) — the listing or conversation being reported
    - `category` (text) — e.g. 'spam', 'fraud', 'inappropriate', etc.
    - `description` (text, nullable)
    - `status` (text, default 'pending') — pending / reviewed / dismissed
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled
  - Authenticated users can insert their own reports
  - Users can view their own reports
  - No update/delete for regular users (admin-only)
*/

CREATE TABLE IF NOT EXISTS reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  target_type text NOT NULL CHECK (target_type IN ('listing', 'conversation')),
  target_id uuid NOT NULL,
  category text NOT NULL,
  description text,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'reviewed', 'dismissed')),
  created_at timestamptz DEFAULT now()
);

ALTER TABLE reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can insert own reports"
  ON reports FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = reporter_id);

CREATE POLICY "Users can view own reports"
  ON reports FOR SELECT
  TO authenticated
  USING (auth.uid() = reporter_id);
