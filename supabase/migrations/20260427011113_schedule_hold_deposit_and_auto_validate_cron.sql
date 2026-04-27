/*
  # Schedule the missing deposit + auto-validation cron jobs (audit P0 #2)

  Background
  ----------
  CLAUDE.md and the edge function code both describe these jobs as
  cron-driven, but cron.job in production only had two entries:
    - expire-stale-conversations (hourly)
    - expire-stale-pending-payments-every-10m (every 10 min)

  The deferred-deposit and auto-validation flows therefore had no
  scheduler. Concretely:
    - rentals longer than 2 days never had a deposit hold authorised
      because nothing ever invoked hold-deposit;
    - completed rentals never auto-finalised 24h after the return
      because nothing ever invoked auto-validate-bookings.

  This migration registers the two missing schedules using the same
  pattern as the existing expire-stale-pending-payments job:
  pg_cron fires net.http_post against the edge function URL with the
  internal secret in the `x-internal-secret` header. Both functions
  are idempotent (each looks at booking state before acting) so
  doubled fires are safe.

  Schedules:
    - hold-deposit: 02:00 UTC every day. The function processes
      bookings whose end_date <= now + 2d; once-a-day cadence is
      enough because the window is two full days wide.
    - auto-validate-bookings: every hour at HH:15 to avoid overlapping
      with the on-the-hour expire-stale-conversations job.

  Security caveat
  ---------------
  pg_cron stores the SQL command as plain text in cron.job, so the
  internal secret literal ends up readable by any role granted SELECT
  on cron.job. The placeholder below (`__INTERNAL_EDGE_SECRET__`) must
  be replaced with the real value at apply time. Production already
  carries the same secret in the existing expire-stale-pending-payments
  schedule; switching all three to Supabase Vault is tracked
  separately.

  How to apply manually after a fresh `supabase db reset`:
  1. supabase secrets list  (find INTERNAL_EDGE_SECRET)
  2. Search-replace `__INTERNAL_EDGE_SECRET__` in this file with the
     real value before running the migration, then revert. Or run the
     two cron.schedule() calls directly via psql once the secret is
     known. Do not commit the substituted file.
*/

SELECT cron.schedule(
  'hold-deposit-daily',
  '0 2 * * *',
  $$
  select
    net.http_post(
      url := 'https://mpqwdschdxbavxjvorvj.supabase.co/functions/v1/hold-deposit',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-internal-secret', '__INTERNAL_EDGE_SECRET__'
      ),
      body := '{}'::jsonb
    );
  $$
);

SELECT cron.schedule(
  'auto-validate-bookings-hourly',
  '15 * * * *',
  $$
  select
    net.http_post(
      url := 'https://mpqwdschdxbavxjvorvj.supabase.co/functions/v1/auto-validate-bookings',
      headers := jsonb_build_object(
        'Content-Type', 'application/json',
        'x-internal-secret', '__INTERNAL_EDGE_SECRET__'
      ),
      body := '{}'::jsonb
    );
  $$
);
