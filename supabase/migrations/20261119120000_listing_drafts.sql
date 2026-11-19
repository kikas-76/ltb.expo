-- Brouillons d'annonce créés sans compte, depuis le lien /publier (web).
--
-- Le visiteur remplit son annonce, puis crée son compte. La confirmation de
-- l'e-mail peut s'ouvrir dans un autre navigateur (appli Gmail, Instagram…) :
-- le brouillon et ses photos sont donc gardés côté serveur, retrouvés grâce à
-- un jeton secret (gardé dans le navigateur et dans user_metadata.publish_draft).
--
-- Aucun accès direct : tout passe par la fonction edge `listing-draft`
-- (clé service_role). Les photos vont dans un bucket privé, recopiées dans
-- listing-photos/<user_id>/ à la publication puis supprimées.

create table if not exists public.listing_drafts (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  status text not null default 'pending_photos'
    check (status in ('pending_photos', 'ready', 'publishing', 'published', 'failed')),
  data jsonb not null,
  photo_paths text[] not null default '{}',
  source text,
  ip_hash text,
  claimed_by uuid references auth.users (id) on delete set null,
  listing_id uuid references public.listings (id) on delete set null,
  error text,
  created_at timestamptz not null default now(),
  ready_at timestamptz,
  claimed_at timestamptz,
  published_at timestamptz
);

comment on table public.listing_drafts is
  'Annonces préparées sans compte via /publier ; accès uniquement par la fonction listing-draft.';

alter table public.listing_drafts enable row level security;
revoke all on public.listing_drafts from anon, authenticated;

create index if not exists listing_drafts_created_at_idx on public.listing_drafts (created_at);
create index if not exists listing_drafts_source_idx on public.listing_drafts (source);

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('listing-drafts', 'listing-drafts', false, 10485760, array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif'])
on conflict (id) do nothing;
