/*
  # Admin moderation system: account status, audit logs, account events

  ## Summary
  This migration adds account moderation capabilities to the platform.

  ## Changes

  ### Modified Tables
  - `profiles`
    - `account_status` (text, default 'active'): current status of the user account — values: active, suspended, banned, pending
    - `ban_reason` (text, nullable): reason entered by the admin when suspending or banning
    - `banned_until` (timestamptz, nullable): null means permanent ban; a date means temporary suspension end date
    - `banned_by` (uuid, nullable): foreign key to profiles.id of the admin who took the action

  ### New Tables
  - `admin_audit_logs`: Full audit trail of all admin actions
    - `id` (uuid, PK)
    - `admin_id` (uuid, FK profiles): the admin who performed the action
    - `action` (text): type of action (suspend_user, ban_user, unban_user, flag_transaction, etc.)
    - `target_type` (text): type of entity targeted (user, listing, booking, dispute, report)
    - `target_id` (uuid): ID of the targeted entity
    - `details` (jsonb): additional contextual data
    - `ip_address` (text, nullable): IP address of the admin (optional)
    - `created_at` (timestamptz)

  - `user_account_events`: History of moderation actions per user
    - `id` (uuid, PK)
    - `user_id` (uuid, FK profiles): the affected user
    - `event_type` (text): type of event (suspended, banned, unbanned, warned)
    - `performed_by` (uuid, FK profiles): admin who performed the action
    - `reason` (text): reason for the action
    - `duration_days` (int, nullable): number of days for temporary actions
    - `expires_at` (timestamptz, nullable): when the suspension expires
    - `created_at` (timestamptz)

  ## Security
  - RLS enabled on both new tables
  - `admin_audit_logs`: admins can read and insert; others cannot access
  - `user_account_events`: admins have full read/write; users can read only their own events

  ## Notes
  1. Uses JWT app_metadata role check to avoid infinite recursion on profiles table
  2. All new columns on profiles are nullable or have safe defaults
*/

-- Add account moderation columns to profiles
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'account_status'
  ) THEN
    ALTER TABLE profiles ADD COLUMN account_status text NOT NULL DEFAULT 'active';
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'ban_reason'
  ) THEN
    ALTER TABLE profiles ADD COLUMN ban_reason text;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'banned_until'
  ) THEN
    ALTER TABLE profiles ADD COLUMN banned_until timestamptz;
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'banned_by'
  ) THEN
    ALTER TABLE profiles ADD COLUMN banned_by uuid REFERENCES profiles(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Create admin_audit_logs table
CREATE TABLE IF NOT EXISTS admin_audit_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  admin_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  action text NOT NULL,
  target_type text NOT NULL,
  target_id uuid,
  details jsonb DEFAULT '{}',
  ip_address text,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE admin_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_admin_id ON admin_audit_logs(admin_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_target_id ON admin_audit_logs(target_id);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_action ON admin_audit_logs(action);
CREATE INDEX IF NOT EXISTS idx_admin_audit_logs_created_at ON admin_audit_logs(created_at DESC);

CREATE POLICY "Admins can read audit logs"
  ON admin_audit_logs FOR SELECT
  TO authenticated
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Admins can insert audit logs"
  ON admin_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

-- Create user_account_events table
CREATE TABLE IF NOT EXISTS user_account_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  performed_by uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason text NOT NULL DEFAULT '',
  duration_days int,
  expires_at timestamptz,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE user_account_events ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_user_account_events_user_id ON user_account_events(user_id);
CREATE INDEX IF NOT EXISTS idx_user_account_events_performed_by ON user_account_events(performed_by);
CREATE INDEX IF NOT EXISTS idx_user_account_events_created_at ON user_account_events(created_at DESC);

CREATE POLICY "Admins can read all account events"
  ON user_account_events FOR SELECT
  TO authenticated
  USING ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');

CREATE POLICY "Users can read own account events"
  ON user_account_events FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can insert account events"
  ON user_account_events FOR INSERT
  TO authenticated
  WITH CHECK ((select auth.jwt() -> 'app_metadata' ->> 'role') = 'admin');
