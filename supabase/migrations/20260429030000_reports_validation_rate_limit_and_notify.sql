/*
  # Reports — target validation, rate limit, length cap, admin notify

  Builds on 20260429020000 (admin RLS + status enum + category whitelist
  + dedup pending) by closing the remaining gaps:

  1. **Server-side description cap.** The form caps at 600 chars
     client-side; nothing stops a curl bypass. CHECK at the row level.

  2. **Target existence.** target_id is a bare uuid pointing at either
     a listing or a conversation depending on target_type. Without
     validation, a malicious client can submit any uuid and pollute the
     queue with reports against rows that never existed. A BEFORE INSERT
     trigger validates the target row exists (any status / state is OK
     — reports about deactivated listings stay valid).

  3. **Per-user rate limit.** The existing partial UNIQUE index blocks
     duplicate pending reports against the same target, but a determined
     user can still spam many *different* targets. Cap at 10 reports per
     user per rolling 24h. service_role bypasses (admins / cron / future
     bulk imports).

  4. **Admin notification.** Insert a `new_report` row in the existing
     notifications table for every admin profile when a report is filed.
     This avoids building a parallel inbox and feeds whatever badge the
     admin dashboard already exposes for unread notifications.
*/

-- 1. Description length cap (NULL still allowed: CHECK passes on NULL)
ALTER TABLE public.reports DROP CONSTRAINT IF EXISTS reports_description_length_check;
ALTER TABLE public.reports
  ADD CONSTRAINT reports_description_length_check
  CHECK (description IS NULL OR length(description) <= 600);

-- 2. Target validation. The function is SECURITY INVOKER so it runs
--    with the caller's privileges — the EXISTS sub-selects work because
--    every authenticated user can SELECT id from listings / conversations.
CREATE OR REPLACE FUNCTION public.reports_validate_target()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.target_type = 'listing' THEN
    IF NOT EXISTS (SELECT 1 FROM public.listings WHERE id = NEW.target_id) THEN
      RAISE EXCEPTION 'reported listing does not exist'
        USING ERRCODE = '23503';
    END IF;
  ELSIF NEW.target_type = 'conversation' THEN
    IF NOT EXISTS (SELECT 1 FROM public.conversations WHERE id = NEW.target_id) THEN
      RAISE EXCEPTION 'reported conversation does not exist'
        USING ERRCODE = '23503';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reports_validate_target_trg ON public.reports;
CREATE TRIGGER reports_validate_target_trg
  BEFORE INSERT ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.reports_validate_target();

-- 3. Rate limit. 10/user/rolling-24h. service_role bypasses so we don't
--    accidentally throttle backfills or admin-driven imports.
CREATE OR REPLACE FUNCTION public.reports_enforce_rate_limit()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_recent int;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT count(*) INTO v_recent
    FROM public.reports
   WHERE reporter_id = NEW.reporter_id
     AND created_at >= now() - interval '24 hours';

  IF v_recent >= 10 THEN
    RAISE EXCEPTION 'report rate limit exceeded (10 per 24h)'
      USING ERRCODE = '54000';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reports_rate_limit_trg ON public.reports;
CREATE TRIGGER reports_rate_limit_trg
  BEFORE INSERT ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.reports_enforce_rate_limit();

-- 4. Admin notifications. SECURITY DEFINER so we can insert into the
--    notifications table regardless of the caller's RLS — admins should
--    receive the alert even though the reporter doesn't have any
--    privilege on rows they don't own.
CREATE OR REPLACE FUNCTION public.reports_notify_admins()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_target_label text;
BEGIN
  v_target_label := CASE NEW.target_type
    WHEN 'listing'      THEN 'une annonce'
    WHEN 'conversation' THEN 'une conversation'
    ELSE                     'un élément'
  END;

  INSERT INTO public.notifications (user_id, type, title, body, data, is_read)
  SELECT
    p.id,
    'new_report',
    'Nouveau signalement',
    'Un signalement a été déposé sur ' || v_target_label || ' (' || NEW.category || ')',
    jsonb_build_object(
      'report_id',   NEW.id,
      'target_type', NEW.target_type,
      'target_id',   NEW.target_id,
      'category',    NEW.category
    ),
    false
  FROM public.profiles p
  WHERE p.role = 'admin';

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reports_notify_admins_trg ON public.reports;
CREATE TRIGGER reports_notify_admins_trg
  AFTER INSERT ON public.reports
  FOR EACH ROW
  EXECUTE FUNCTION public.reports_notify_admins();
