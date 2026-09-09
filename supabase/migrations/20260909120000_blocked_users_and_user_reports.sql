-- Blocage d'utilisateurs (App Review guideline 1.2) et signalement d'un utilisateur.
-- Appliqué en prod le 2026-09-09 via MCP (nom : blocked_users_and_user_reports).

create table if not exists public.blocked_users (
  blocker_id uuid not null references public.profiles(id) on delete cascade,
  blocked_id uuid not null references public.profiles(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key (blocker_id, blocked_id),
  constraint blocked_users_not_self check (blocker_id <> blocked_id)
);
create index if not exists idx_blocked_users_blocked on public.blocked_users (blocked_id);
alter table public.blocked_users enable row level security;

drop policy if exists "blocked_users_select_own" on public.blocked_users;
create policy "blocked_users_select_own" on public.blocked_users
  for select to authenticated using (auth.uid() = blocker_id);
drop policy if exists "blocked_users_insert_own" on public.blocked_users;
create policy "blocked_users_insert_own" on public.blocked_users
  for insert to authenticated with check (auth.uid() = blocker_id and blocker_id <> blocked_id);
drop policy if exists "blocked_users_delete_own" on public.blocked_users;
create policy "blocked_users_delete_own" on public.blocked_users
  for delete to authenticated using (auth.uid() = blocker_id);
grant select, insert, delete on public.blocked_users to authenticated;

-- Vrai si l'un des deux a bloqué l'autre. SECURITY DEFINER : utilisable dans
-- les policies et les triggers sans exposer la table.
create or replace function public.is_blocked_between(a uuid, b uuid)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select exists (
    select 1 from public.blocked_users
    where (blocker_id = a and blocked_id = b) or (blocker_id = b and blocked_id = a)
  );
$$;
revoke all on function public.is_blocked_between(uuid, uuid) from public;
grant execute on function public.is_blocked_between(uuid, uuid) to anon, authenticated, service_role;

create or replace function public.get_block_status(p_other uuid)
returns jsonb language sql stable security definer set search_path = public, pg_temp as $$
  select jsonb_build_object(
    'blocked_by_me',   exists (select 1 from public.blocked_users where blocker_id = auth.uid() and blocked_id = p_other),
    'blocked_by_them', exists (select 1 from public.blocked_users where blocker_id = p_other and blocked_id = auth.uid())
  );
$$;
revoke all on function public.get_block_status(uuid) from public;
grant execute on function public.get_block_status(uuid) to authenticated;

create or replace function public.get_blocked_users()
returns table (id uuid, username text, avatar_url text, photo_url text, blocked_at timestamptz)
language sql stable security definer set search_path = public, pg_temp as $$
  select p.id, p.username, p.avatar_url, p.photo_url, b.created_at
  from public.blocked_users b
  join public.profiles p on p.id = b.blocked_id
  where b.blocker_id = auth.uid()
  order by b.created_at desc;
$$;
revoke all on function public.get_blocked_users() from public;
grant execute on function public.get_blocked_users() to authenticated;

-- Aucune nouvelle conversation, aucun message (hors messages système) et
-- aucune réservation entre deux utilisateurs dont l'un a bloqué l'autre.
-- Triggers plutôt que policies : ils s'appliquent aussi aux RPC SECURITY DEFINER.
create or replace function public.reject_if_blocked_conversation()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if public.is_blocked_between(new.requester_id, new.owner_id) then
    raise exception 'Vous ne pouvez pas contacter cet utilisateur.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists conversations_reject_blocked on public.conversations;
create trigger conversations_reject_blocked
  before insert on public.conversations for each row execute function public.reject_if_blocked_conversation();

create or replace function public.reject_if_blocked_message()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  v_requester uuid;
  v_owner uuid;
begin
  if coalesce(new.is_system, false) then
    return new;
  end if;
  select requester_id, owner_id into v_requester, v_owner from public.conversations where id = new.conversation_id;
  if v_requester is not null and public.is_blocked_between(v_requester, v_owner) then
    raise exception 'Vous ne pouvez plus échanger avec cet utilisateur.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists chat_messages_reject_blocked on public.chat_messages;
create trigger chat_messages_reject_blocked
  before insert on public.chat_messages for each row execute function public.reject_if_blocked_message();

create or replace function public.reject_if_blocked_booking()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if public.is_blocked_between(new.renter_id, new.owner_id) then
    raise exception 'Vous ne pouvez pas réserver auprès de cet utilisateur.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
drop trigger if exists bookings_reject_blocked on public.bookings;
create trigger bookings_reject_blocked
  before insert on public.bookings for each row execute function public.reject_if_blocked_booking();

-- Les annonces des utilisateurs bloqués (dans un sens ou l'autre) sont masquées.
drop policy if exists "listings_hide_blocked" on public.listings;
create policy "listings_hide_blocked" on public.listings as restrictive
  for select to authenticated
  using (owner_id = auth.uid() or not public.is_blocked_between(auth.uid(), owner_id));

-- RPC SECURITY DEFINER : même filtre (get_nearby_listings et search_listings_v2
-- recréées avec `AND NOT public.is_blocked_between(auth.uid(), l.owner_id)` ;
-- définitions complètes : voir 20260416073613 et 20260904210000).

-- Signalement d'un utilisateur.
alter table public.reports drop constraint if exists reports_target_type_check;
alter table public.reports add constraint reports_target_type_check
  check (target_type in ('listing', 'conversation', 'user'));

CREATE OR REPLACE FUNCTION public.reports_validate_target()
 RETURNS trigger LANGUAGE plpgsql SET search_path TO 'public', 'pg_temp'
AS $function$
BEGIN
  IF NEW.target_type = 'listing' THEN
    IF NOT EXISTS (SELECT 1 FROM public.listings WHERE id = NEW.target_id) THEN
      RAISE EXCEPTION 'reported listing does not exist' USING ERRCODE = '23503';
    END IF;
  ELSIF NEW.target_type = 'conversation' THEN
    IF NOT EXISTS (SELECT 1 FROM public.conversations WHERE id = NEW.target_id) THEN
      RAISE EXCEPTION 'reported conversation does not exist' USING ERRCODE = '23503';
    END IF;
  ELSIF NEW.target_type = 'user' THEN
    IF NEW.target_id = auth.uid() THEN
      RAISE EXCEPTION 'cannot report yourself' USING ERRCODE = '23514';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.public_profiles WHERE id = NEW.target_id) THEN
      RAISE EXCEPTION 'reported user does not exist' USING ERRCODE = '23503';
    END IF;
  END IF;
  RETURN NEW;
END;
$function$;

-- reports_notify_admins : libellé 'un utilisateur' ajouté au CASE sur target_type.
