-- Nettoyage quotidien des brouillons /publier non publiés (plus de 7 jours) et
-- de leurs photos, via la fonction listing-draft (action cleanup). Le secret
-- interne est relu dans le job hold-deposit-daily pour ne pas le recopier.
select cron.schedule(
  'listing-drafts-cleanup-daily',
  '35 3 * * *',
  $$
  select net.http_post(
    url := 'https://mpqwdschdxbavxjvorvj.supabase.co/functions/v1/listing-draft',
    headers := (select jsonb_build_object('Content-Type', 'application/json', 'x-internal-secret', h->>'x-internal-secret')
                from (select (regexp_match(command, '''x-internal-secret'',\s*''([^'']+)'''))[1] as s from cron.job where jobname = 'hold-deposit-daily') j,
                lateral (select jsonb_build_object('x-internal-secret', j.s) as h) x),
    body := '{"action":"cleanup"}'::jsonb
  );
  $$
);
