-- Push notification tokens (Expo Push).
--
-- One row per device token. `token` is the PK: a physical device that
-- switches accounts (logout → login) re-upserts its token onto the new
-- user_id, so a device never receives pushes for an account it left.
--
-- Registration goes through a SECURITY DEFINER RPC rather than direct
-- INSERT: reassigning a token previously owned by another user is an
-- UPDATE on a row the caller doesn't own, which row-level policies
-- can't allow without opening the table too wide.
--
-- Edge functions read this table with the service role (RLS bypassed);
-- clients can only see and delete their own rows.

create table public.push_tokens (
  token text primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  platform text not null default 'ios',
  updated_at timestamptz not null default now()
);

create index push_tokens_user_id_idx on public.push_tokens (user_id);

alter table public.push_tokens enable row level security;

create policy "push_tokens_select_own"
  on public.push_tokens for select
  to authenticated
  using (user_id = (select auth.uid()));

create policy "push_tokens_delete_own"
  on public.push_tokens for delete
  to authenticated
  using (user_id = (select auth.uid()));

create or replace function public.register_push_token(p_token text, p_platform text default 'ios')
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'not authenticated';
  end if;
  if p_token is null or length(trim(p_token)) = 0 or length(p_token) > 400 then
    raise exception 'invalid token';
  end if;

  insert into public.push_tokens (token, user_id, platform, updated_at)
  values (trim(p_token), auth.uid(), coalesce(nullif(trim(p_platform), ''), 'ios'), now())
  on conflict (token) do update
    set user_id = auth.uid(),
        platform = excluded.platform,
        updated_at = now();
end;
$$;

revoke all on function public.register_push_token(text, text) from public, anon;
grant execute on function public.register_push_token(text, text) to authenticated;
