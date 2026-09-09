-- Modération effective (App Review 1.2). Appliqué en prod le 2026-09-09 (nom MCP : moderation_enforcement).
--  1. un compte suspendu / banni ne peut plus publier, écrire, réserver, signaler ni noter
--     (is_caller_active + trigger reject_if_caller_inactive sur chat_messages, conversations,
--     listings, bookings, reports, reviews) ;
--  2. filtre de termes interdits avant publication : table moderation_blocked_terms (gérée en SQL,
--     aucun accès client), contains_blocked_term(text), trigger reject_blocked_terms sur
--     chat_messages (insert), listings (insert / update du nom ou de la description), reviews ;
--  3. signalement d'un avis (target_type 'review' + validation + libellé admin) ;
--  4. admin_deactivate_listing(uuid) pour désactiver une annonce signalée (rôle admin vérifié).
-- Définitions complètes : voir l'historique des migrations Supabase (dashboard) ; ce fichier
-- documente l'intention, le SQL exécuté est identique à celui du dashboard.

create or replace function public.is_caller_active()
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select case
    when auth.uid() is null then true
    else coalesce((
      select case
        when p.account_status in ('banned', 'deleted') then false
        when p.account_status = 'suspended' then (p.banned_until is not null and p.banned_until < now())
        else true
      end
      from public.profiles p where p.id = auth.uid()
    ), false)
  end;
$$;
grant execute on function public.is_caller_active() to anon, authenticated, service_role;

create or replace function public.reject_if_caller_inactive()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if tg_table_name = 'chat_messages' then
    if coalesce((to_jsonb(new)->>'is_system')::boolean, false) then
      return new;
    end if;
  end if;
  if not public.is_caller_active() then
    raise exception 'Votre compte est suspendu. Contactez admin@louetonbien.fr.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger chat_messages_require_active before insert on public.chat_messages for each row execute function public.reject_if_caller_inactive();
create trigger conversations_require_active before insert on public.conversations for each row execute function public.reject_if_caller_inactive();
create trigger listings_require_active before insert or update on public.listings for each row execute function public.reject_if_caller_inactive();
create trigger bookings_require_active before insert or update on public.bookings for each row execute function public.reject_if_caller_inactive();
create trigger reports_require_active before insert on public.reports for each row execute function public.reject_if_caller_inactive();
create trigger reviews_require_active before insert on public.reviews for each row execute function public.reject_if_caller_inactive();

create table if not exists public.moderation_blocked_terms (term text primary key, created_at timestamptz not null default now());
alter table public.moderation_blocked_terms enable row level security;
-- seed : insultes et injures discriminatoires (liste modifiable en SQL par les admins)

create or replace function public.contains_blocked_term(p_text text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.moderation_blocked_terms t
    where lower(coalesce(p_text, '')) ~* ('\m' || regexp_replace(t.term, '([.*+?^${}()|[\]\\])', '\\\1', 'g') || '\M')
  );
$$;
grant execute on function public.contains_blocked_term(text) to authenticated, service_role;

create or replace function public.reject_blocked_terms()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare v_text text;
begin
  if tg_table_name = 'chat_messages' then
    if coalesce((to_jsonb(new)->>'is_system')::boolean, false) then return new; end if;
    v_text := to_jsonb(new)->>'content';
  elsif tg_table_name = 'listings' then
    v_text := coalesce(to_jsonb(new)->>'name', '') || ' ' || coalesce(to_jsonb(new)->>'description', '');
  elsif tg_table_name = 'reviews' then
    v_text := to_jsonb(new)->>'comment';
  end if;
  if v_text is not null and public.contains_blocked_term(v_text) then
    raise exception 'Ce contenu contient des termes interdits par nos conditions d''utilisation.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
create trigger chat_messages_blocked_terms before insert on public.chat_messages for each row execute function public.reject_blocked_terms();
create trigger listings_blocked_terms_insert before insert on public.listings for each row execute function public.reject_blocked_terms();
create trigger listings_blocked_terms_update before update on public.listings for each row
  when (new.name is distinct from old.name or new.description is distinct from old.description) execute function public.reject_blocked_terms();
create trigger reviews_blocked_terms before insert or update on public.reviews for each row execute function public.reject_blocked_terms();

alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check check (target_type in ('listing', 'conversation', 'user', 'review'));
-- reports_validate_target : branche 'review' (existence dans reviews) ; reports_notify_admins : libellé 'un avis'.

create or replace function public.admin_deactivate_listing(p_listing_id uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if not exists (select 1 from public.profiles where id = auth.uid() and role = 'admin') then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.listings set is_active = false where id = p_listing_id;
end;
$$;
revoke all on function public.admin_deactivate_listing(uuid) from public, anon;
grant execute on function public.admin_deactivate_listing(uuid) to authenticated;
