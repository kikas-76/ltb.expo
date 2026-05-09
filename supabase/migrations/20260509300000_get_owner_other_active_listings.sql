/*
  # RPC get_owner_other_active_listings

  Cross-sell pro : retourne les autres annonces actives d'un même pro,
  avec un filtre optionnel de saturation par fenêtre (mêmes dates qu'une
  location en cours côté locataire). Utilisée par :
  - app/listing/[id].tsx (carousel "Plus d'objets de @Pro")
  - app/owner/[id].tsx (filtré quand l'URL porte ?start=&end=)

  Le filtre saturation réutilise la même logique SUM(quantity) /
  stock_count que le trigger bookings_enforce_stock — cohérence garantie.
*/

CREATE OR REPLACE FUNCTION public.get_owner_other_active_listings(
  p_owner_id    uuid,
  p_exclude_id  uuid DEFAULT NULL,
  p_start_date  date DEFAULT NULL,
  p_end_date    date DEFAULT NULL,
  p_limit       int  DEFAULT 12
)
RETURNS TABLE (
  id uuid,
  name text,
  price numeric,
  photos_url text[],
  category_name text,
  category_id uuid,
  approx_latitude double precision,
  approx_longitude double precision,
  rating_avg numeric,
  rating_count integer,
  stock_count int,
  packs jsonb,
  owner_id uuid,
  owner_username text,
  owner_photo_url text,
  owner_is_pro boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
  SELECT
    l.id,
    l.name,
    l.price,
    l.photos_url,
    l.category_name,
    l.category_id,
    l.approx_latitude,
    l.approx_longitude,
    l.rating_avg,
    l.rating_count,
    l.stock_count,
    l.packs,
    p.id          AS owner_id,
    p.username    AS owner_username,
    p.photo_url   AS owner_photo_url,
    p.is_pro      AS owner_is_pro
  FROM public.listings l
  JOIN public.profiles p ON p.id = l.owner_id
  WHERE l.owner_id = p_owner_id
    AND l.is_active = true
    AND (p_exclude_id IS NULL OR l.id <> p_exclude_id)
    AND (
      p_start_date IS NULL OR p_end_date IS NULL OR
      l.stock_count > COALESCE((
        SELECT SUM(b.quantity)
        FROM public.bookings b
        WHERE b.listing_id = l.id
          AND b.status IN (
            'pending_payment','active','in_progress',
            'pending_return','pending_owner_validation','disputed'
          )
          AND tstzrange(b.start_date, b.end_date, '[)')
              && tstzrange(
                (p_start_date::text || ' 00:00:00')::timestamptz,
                (p_end_date::text   || ' 23:59:59')::timestamptz,
                '[)'
              )
      ), 0)
    )
  ORDER BY l.created_at DESC
  LIMIT p_limit;
$function$;

GRANT EXECUTE ON FUNCTION public.get_owner_other_active_listings(uuid, uuid, date, date, int)
  TO authenticated, anon;
