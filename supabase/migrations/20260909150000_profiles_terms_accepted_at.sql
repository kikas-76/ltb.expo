-- Date d'acceptation des CGU / politique de confidentialité (affichée à l'inscription,
-- enregistrée à la fin de l'onboarding). Appliqué en prod le 2026-09-09.
alter table public.profiles add column if not exists terms_accepted_at timestamptz;
grant update (terms_accepted_at) on public.profiles to authenticated;
