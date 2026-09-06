-- Accueil en un seul appel : catégories + rails (récents, populaires, bons plans,
-- favoris du user, proches si coordonnées). SECURITY INVOKER (RLS des listings).
-- Appliqué en prod le 2026-09-03 via MCP ; définition relue depuis pg_get_functiondef.
CREATE OR REPLACE FUNCTION public.get_home_feed(p_lat double precision DEFAULT NULL::double precision, p_lng double precision DEFAULT NULL::double precision, p_limit integer DEFAULT 19)
 RETURNS jsonb
 LANGUAGE sql
 STABLE
 SET search_path TO 'public'
AS $function$
  with card as (
    select
      l.id, l.name, l.price, l.photos_url, l.category_name, l.category_id,
      l.approx_latitude, l.approx_longitude, l.rating_avg, l.rating_count,
      l.views_count, l.saves_count, l.created_at,
      jsonb_build_object(
        'id', p.id, 'username', p.username, 'photo_url', p.photo_url, 'is_pro', p.is_pro
      ) as owner
    from public.listings l
    left join public.profiles p on p.id = l.owner_id
    where l.is_active = true
  )
  select jsonb_build_object(
    'categories', (
      select coalesce(jsonb_agg(
        jsonb_build_object('id', c.id, 'name', c.name, 'value', c.value, 'icon_path', c.icon_path)
        order by c."order"
      ), '[]'::jsonb)
      from public.categories c
    ),
    'recent', (
      select coalesce(jsonb_agg(
        to_jsonb(r) - 'views_count' - 'saves_count' - 'created_at'
        order by r.created_at desc
      ), '[]'::jsonb)
      from (select * from card order by created_at desc limit p_limit) r
    ),
    'popular', (
      select coalesce(jsonb_agg(
        to_jsonb(r) - 'created_at'
        order by r.views_count desc nulls last
      ), '[]'::jsonb)
      from (select * from card order by views_count desc nulls last limit 10) r
    ),
    'deals', (
      select coalesce(jsonb_agg(
        to_jsonb(r) - 'views_count' - 'saves_count' - 'created_at'
        order by r.price asc
      ), '[]'::jsonb)
      from (select * from card order by price asc limit 10) r
    ),
    'favorites', case
      when auth.uid() is null then '[]'::jsonb
      else (
        select coalesce(jsonb_agg(
          to_jsonb(r) - 'views_count' - 'saves_count' - 'created_at' - 'saved_at'
          order by r.saved_at desc
        ), '[]'::jsonb)
        from (
          select c.*, s.saved_at
          from public.saved_listings s
          join card c on c.id = s.listing_id
          where s.user_id = auth.uid()
          order by s.saved_at desc
          limit 4
        ) r
      )
    end,
    'nearby', case
      when p_lat is null or p_lng is null then null
      else (
        select coalesce(jsonb_agg(to_jsonb(n) order by n.distance_km), '[]'::jsonb)
        from public.get_nearby_listings(p_lat, p_lng, 9999, p_limit, 0) n
      )
    end
  );
$function$;
GRANT EXECUTE ON FUNCTION public.get_home_feed(p_lat double precision, p_lng double precision, p_limit integer) TO anon;
GRANT EXECUTE ON FUNCTION public.get_home_feed(p_lat double precision, p_lng double precision, p_limit integer) TO authenticated;
