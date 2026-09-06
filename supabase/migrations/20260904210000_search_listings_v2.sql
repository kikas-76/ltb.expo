-- Recherche en un appel : search_listings + propriétaire + note, pour la page recherche.
-- Appliqué en prod le 2026-09-04 via MCP ; définition relue depuis pg_get_functiondef.
CREATE OR REPLACE FUNCTION public.search_listings_v2(search_query text, lim integer DEFAULT 200)
 RETURNS TABLE(id uuid, name text, price numeric, photos_url text[], category_name text, category_id uuid, approx_latitude double precision, approx_longitude double precision, owner_type text, rank real, rating_avg numeric, rating_count integer, owner_id uuid, owner_username text, owner_photo_url text, owner_is_pro boolean)
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO 'public', 'pg_catalog'
AS $function$
  select
    s.id, s.name, s.price, s.photos_url, s.category_name, s.category_id,
    s.approx_latitude, s.approx_longitude, s.owner_type, s.rank,
    l.rating_avg, l.rating_count,
    p.id as owner_id, p.username as owner_username, p.photo_url as owner_photo_url, p.is_pro as owner_is_pro
  from public.search_listings(search_query, lim) s
  join public.listings l on l.id = s.id
  left join public.profiles p on p.id = l.owner_id
  order by s.rank desc, l.created_at desc;
$function$;
GRANT EXECUTE ON FUNCTION public.search_listings_v2(search_query text, lim integer) TO anon;
GRANT EXECUTE ON FUNCTION public.search_listings_v2(search_query text, lim integer) TO authenticated;
