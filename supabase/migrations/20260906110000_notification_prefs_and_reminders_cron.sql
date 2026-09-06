-- Préférences de notifications push (par catégorie) + cron des rappels quotidiens.
-- Appliqué en prod le 2026-09-06 via MCP (la valeur de x-internal-secret est celle
-- des autres jobs cron : select command from cron.job).

alter table public.profiles
  add column if not exists notification_prefs jsonb not null
  default '{"messages":true,"bookings":true,"reminders":true,"news":true}'::jsonb;

grant update (notification_prefs) on public.profiles to authenticated;

-- 07:00 UTC (≈ 09:00 Paris) : veille de location, jour du retour, validation en attente.
-- select cron.schedule(
--   'send-reminders-daily', '0 7 * * *',
--   $$ select net.http_post(
--        url := 'https://mpqwdschdxbavxjvorvj.supabase.co/functions/v1/send-reminders',
--        headers := '{"Content-Type": "application/json", "x-internal-secret": "<INTERNAL_EDGE_SECRET>"}'::jsonb,
--        body := '{}'::jsonb) $$
-- );
