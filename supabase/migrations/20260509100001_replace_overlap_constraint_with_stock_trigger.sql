/*
  # Remplacer la contrainte EXCLUDE par un trigger somme-de-quantités

  La contrainte EXCLUDE (bookings_no_overlap_active) interdisait TOUT
  chevauchement de dates sur le même listing_id. Avec stock multi, on
  veut autoriser plusieurs bookings simultanés tant que la somme des
  quantités sur la fenêtre <= stock_count.

  Le trigger fait un SELECT FOR UPDATE sur la ligne listings pour
  sérialiser les inserts concurrents (anti race-condition : deux
  paiements simultanés ne peuvent pas conjointement dépasser le stock).

  Les statuts terminaux (cancelled, refused, expired, completed) ne
  consomment plus de stock — ils sont exclus du SUM.
*/

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_no_overlap_active;

CREATE OR REPLACE FUNCTION public.bookings_enforce_stock()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_stock     int;
  v_overlap   int;
BEGIN
  IF NEW.status NOT IN (
    'pending_payment','active','in_progress',
    'pending_return','pending_owner_validation','disputed'
  ) THEN
    RETURN NEW;
  END IF;

  SELECT stock_count INTO v_stock
  FROM public.listings
  WHERE id = NEW.listing_id
  FOR UPDATE;

  IF v_stock IS NULL THEN v_stock := 1; END IF;

  SELECT COALESCE(SUM(quantity), 0) INTO v_overlap
  FROM public.bookings
  WHERE listing_id = NEW.listing_id
    AND id IS DISTINCT FROM NEW.id
    AND status IN (
      'pending_payment','active','in_progress',
      'pending_return','pending_owner_validation','disputed'
    )
    AND tstzrange(start_date, end_date, '[)')
        && tstzrange(NEW.start_date, NEW.end_date, '[)');

  IF v_overlap + NEW.quantity > v_stock THEN
    RAISE EXCEPTION 'Stock insuffisant : il reste % unité(s) sur cette période', GREATEST(0, v_stock - v_overlap)
      USING ERRCODE = '23P01';
  END IF;

  RETURN NEW;
END;
$function$;

DROP TRIGGER IF EXISTS bookings_enforce_stock_trg ON public.bookings;
CREATE TRIGGER bookings_enforce_stock_trg
BEFORE INSERT OR UPDATE OF start_date, end_date, listing_id, quantity, status
ON public.bookings
FOR EACH ROW EXECUTE FUNCTION public.bookings_enforce_stock();
