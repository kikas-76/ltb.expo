/*
  # create_booking_for_payment étendu avec p_quantity

  L'overload 4-args est supprimé pour éviter qu'il coexiste avec la nouvelle
  signature (PostgREST devient ambigu). La nouvelle version a p_quantity
  DEFAULT 1, donc tout client appelant avec 4 args matche déjà.

  Validations supplémentaires :
  - p_quantity >= 1
  - p_quantity <= listings.stock_count
  - Si listings.packs IS NOT NULL → p_quantity DOIT être dans la liste
  - Pre-check de saturation (somme overlap + p_quantity <= stock)

  Calcul du total : v_total = round(price × p_quantity × days × (1 - discount)).
  La caution est aussi multipliée : un pack de 10 chaises a une caution 10×.

  Le trigger bookings_enforce_stock fait foi sous lock — ce pre-check existe
  juste pour offrir un message d'erreur clair côté API.
*/

DROP FUNCTION IF EXISTS public.create_booking_for_payment(uuid, date, date, uuid);

CREATE OR REPLACE FUNCTION public.create_booking_for_payment(
  p_listing_id      uuid,
  p_start_date      date,
  p_end_date        date,
  p_conversation_id uuid,
  p_quantity        int DEFAULT 1
)
RETURNS TABLE(booking_id uuid, total_price numeric, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  v_caller        uuid;
  v_listing       record;
  v_conv          record;
  v_days          int;
  v_discount      numeric;
  v_total         numeric;
  v_overlap_qty   int;
  v_new_id        uuid;
  v_stock         int;
  v_pack_valid    boolean;
BEGIN
  v_caller := auth.uid();
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Authentication required' USING ERRCODE = '42501';
  END IF;

  IF p_listing_id IS NULL OR p_start_date IS NULL
     OR p_end_date IS NULL OR p_conversation_id IS NULL THEN
    RAISE EXCEPTION 'Missing required parameter' USING ERRCODE = '22023';
  END IF;
  IF p_end_date <= p_start_date THEN
    RAISE EXCEPTION 'end_date must be strictly after start_date' USING ERRCODE = '22023';
  END IF;
  IF p_start_date < (now() AT TIME ZONE 'Europe/Paris')::date THEN
    RAISE EXCEPTION 'start_date cannot be in the past' USING ERRCODE = '22023';
  END IF;

  IF p_quantity IS NULL OR p_quantity < 1 THEN
    RAISE EXCEPTION 'Quantity must be at least 1' USING ERRCODE = '22023';
  END IF;

  SELECT l.id, l.owner_id, l.price, l.deposit_amount, l.is_active,
         COALESCE(l.stock_count, 1) AS stock_count,
         l.packs
    INTO v_listing
    FROM public.listings l
   WHERE l.id = p_listing_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Listing not found' USING ERRCODE = '02000';
  END IF;
  IF NOT v_listing.is_active THEN
    RAISE EXCEPTION 'Listing is not active' USING ERRCODE = '22023';
  END IF;
  IF COALESCE(v_listing.price, 0) <= 0 THEN
    RAISE EXCEPTION 'Listing price is invalid' USING ERRCODE = '22023';
  END IF;

  v_stock := v_listing.stock_count;
  IF p_quantity > v_stock THEN
    RAISE EXCEPTION 'La quantité demandée (%) dépasse le stock total (%)', p_quantity, v_stock
      USING ERRCODE = '22023';
  END IF;

  IF v_listing.packs IS NOT NULL THEN
    SELECT EXISTS (
      SELECT 1 FROM jsonb_array_elements(v_listing.packs) e
      WHERE (e::text)::int = p_quantity
    ) INTO v_pack_valid;
    IF NOT v_pack_valid THEN
      RAISE EXCEPTION 'La quantité % ne correspond à aucun pack autorisé', p_quantity
        USING ERRCODE = '22023';
    END IF;
  END IF;

  SELECT c.id, c.listing_id, c.requester_id, c.owner_id
    INTO v_conv
    FROM public.conversations c
   WHERE c.id = p_conversation_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Conversation not found' USING ERRCODE = '02000';
  END IF;
  IF v_conv.listing_id IS DISTINCT FROM p_listing_id THEN
    RAISE EXCEPTION 'Conversation does not match listing' USING ERRCODE = '42501';
  END IF;
  IF v_conv.owner_id IS DISTINCT FROM v_listing.owner_id THEN
    RAISE EXCEPTION 'Conversation owner mismatch' USING ERRCODE = '42501';
  END IF;
  IF v_caller <> v_conv.requester_id AND v_caller <> v_conv.owner_id THEN
    RAISE EXCEPTION 'Caller is not a participant of this conversation' USING ERRCODE = '42501';
  END IF;
  IF v_conv.requester_id = v_listing.owner_id THEN
    RAISE EXCEPTION 'Renter cannot be the listing owner' USING ERRCODE = '42501';
  END IF;

  -- Pre-check saturation (le trigger refait le check sous lock)
  SELECT COALESCE(SUM(b.quantity), 0) INTO v_overlap_qty
    FROM public.bookings b
   WHERE b.listing_id = p_listing_id
     AND b.status IN (
       'pending_payment','active','in_progress',
       'pending_return','pending_owner_validation','disputed'
     )
     AND tstzrange(b.start_date, b.end_date, '[)')
         && tstzrange(
              (p_start_date::text || ' 00:00:00')::timestamptz,
              (p_end_date::text   || ' 23:59:59')::timestamptz,
              '[)'
            );

  IF v_overlap_qty + p_quantity > v_stock THEN
    RAISE EXCEPTION 'Stock insuffisant sur cette période : il reste % unité(s)', GREATEST(0, v_stock - v_overlap_qty)
      USING ERRCODE = '23505';
  END IF;

  v_days := (p_end_date - p_start_date);
  IF v_days <= 0 THEN
    RAISE EXCEPTION 'Rental duration must be at least 1 day' USING ERRCODE = '22023';
  END IF;
  v_discount := CASE
    WHEN v_days >= 7 THEN 0.20
    WHEN v_days >= 3 THEN 0.10
    ELSE 0.00
  END;
  v_total := round(v_listing.price * p_quantity * v_days * (1 - v_discount));

  INSERT INTO public.bookings (
    listing_id, renter_id, owner_id, status,
    start_date, end_date,
    total_price, deposit_amount, conversation_id,
    quantity
  )
  VALUES (
    p_listing_id, v_conv.requester_id, v_listing.owner_id, 'pending_payment',
    (p_start_date::text || ' 00:00:00')::timestamptz,
    (p_end_date::text   || ' 23:59:59')::timestamptz,
    v_total,
    COALESCE(v_listing.deposit_amount, 0) * p_quantity,
    p_conversation_id,
    p_quantity
  )
  RETURNING bookings.id INTO v_new_id;

  RETURN QUERY
    SELECT b.id, b.total_price, b.status
      FROM public.bookings b
     WHERE b.id = v_new_id;
END;
$function$;
