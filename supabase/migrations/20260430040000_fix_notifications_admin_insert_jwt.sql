/*
  # Fix Admin can insert notifications — last JWT-vs-profiles holdout

  Same root cause as 20260430030000: this INSERT policy gated admin
  via `jwt.app_metadata.role = 'admin'`, which never matches because
  admin role lives in `profiles.role`. No user-visible breakage today
  because every notification insert in the codebase goes through
  SECURITY DEFINER triggers (e.g. `reports_notify_admins`) that bypass
  RLS — but if any future admin tool tries
  `from('notifications').insert(...)` it would silently 403.
*/

DROP POLICY IF EXISTS "Admin can insert notifications" ON public.notifications;
CREATE POLICY "Admin can insert notifications"
  ON public.notifications FOR INSERT
  TO authenticated
  WITH CHECK (public.is_current_user_admin());
