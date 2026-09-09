-- Sign in with Apple : le refresh token obtenu à la connexion est conservé
-- chiffré dans Vault, uniquement pour pouvoir le révoquer à la suppression du
-- compte (exigence App Store depuis juin 2022). Fonctions réservées au
-- service_role (edge functions apple-token-exchange et delete-user-account).
-- Appliqué en prod le 2026-09-09.

create or replace function public.store_apple_refresh_token(p_user uuid, p_token text)
returns void language plpgsql security definer set search_path = public, vault, pg_temp as $$
declare
  v_name text := 'apple_refresh_token:' || p_user::text;
  v_id uuid;
begin
  select id into v_id from vault.secrets where name = v_name;
  if v_id is null then
    perform vault.create_secret(p_token, v_name, 'Sign in with Apple refresh token');
  else
    perform vault.update_secret(v_id, p_token);
  end if;
end;
$$;

create or replace function public.pop_apple_refresh_token(p_user uuid)
returns text language plpgsql security definer set search_path = public, vault, pg_temp as $$
declare
  v_name text := 'apple_refresh_token:' || p_user::text;
  v_secret text;
begin
  select decrypted_secret into v_secret from vault.decrypted_secrets where name = v_name;
  delete from vault.secrets where name = v_name;
  return v_secret;
end;
$$;

revoke all on function public.store_apple_refresh_token(uuid, text) from public, anon, authenticated;
revoke all on function public.pop_apple_refresh_token(uuid) from public, anon, authenticated;
grant execute on function public.store_apple_refresh_token(uuid, text) to service_role;
grant execute on function public.pop_apple_refresh_token(uuid) to service_role;
