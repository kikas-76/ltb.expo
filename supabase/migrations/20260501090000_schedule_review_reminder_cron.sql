/*
  # Schedule the review-reminder cron job

  Daily cron that fires the `review-reminder` edge function at 10:00
  UTC. The function selects bookings completed between 24h and 14d
  ago and sends a `review_reminder` email to each participant who
  hasn't reviewed yet. Idempotent on (booking_id, reviewer_id).

  Same pattern as 20260427011113_schedule_hold_deposit_and_auto_validate_cron.sql:
  pg_cron stores the SQL command as plain text, so the literal secret
  ends up readable by any role granted SELECT on cron.job. The
  placeholder below (`__INTERNAL_EDGE_SECRET__`) must be replaced with
  the real value at apply time. Production has the substituted value;
  do not commit the substituted file.

  Live application history
  ------------------------
  Applied directly via execute_sql (not via this file) on 2026-05-01:
  the secret was extracted from the existing `hold-deposit-daily`
  cron entry and reused, so it never had to be typed or pasted into
  source. This file exists for repo hygiene + `supabase db reset`
  reproducibility.
*/

SELECT cron.schedule(
  'review-reminder-daily',
  '0 10 * * *',
  $$
  select
    net.http_post(
      url := 'https://mpqwdschdxbavxjvorvj.supabase.co/functions/v1/review-reminder',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-internal-secret', '__INTERNAL_EDGE_SECRET__'
      ),
      body := '{}'::jsonb
    );
  $$
);
