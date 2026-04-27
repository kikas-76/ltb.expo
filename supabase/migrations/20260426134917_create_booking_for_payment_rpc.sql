/*
  # Server-side booking creation to prevent price tampering

  Background: client-side INSERT on public.bookings let any authenticated
  user supply their own total_price; the create-payment-intent edge function
  then charged the renter the user-supplied amount. This RPC closes that
  hole by recomputing price, deposit_amount, owner_id, dates and
  availability server-side from the listings + conversations tables.

  ## Inputs
    p_listing_id      uuid    — listing being booked
    p_start_date      date    — first day (check-in)
    p_end_date        date    — last day (check-out, exclusive)
    p_conversation_id uuid    — conversation that anchored the request

  ## Outputs
    booking_id, total_price, status

  ## Authorization
  - auth.uid() must be either the conversation requester (renter) or owner
  - Conversation must point to the same listing and the listing's owner
  - Renter cannot be the listing owner
  - Listing must be active with a positive price
  - No overlap with bookings in pending_payment / active / in_progress /
    pending_return / pending_owner_validation / disputed

  ## Pricing (mirrors lib/pricing.ts)
    days     = end - start (hotel model)
    discount = days >= 7 ? 0.20 : days >= 3 ? 0.10 : 0
    total    = round(price_per_day * days * (1 - discount))

  Marked SECURITY DEFINER to bypass RLS while reading listings/bookings
  and to insert into bookings even after we REVOKE the API-side INSERT
  privilege from authenticated/anon.
*/

CREATE OR REPLACE FUNCTION public.create_booking_for_payment(
  p_listing_id      uuid,
  p_start_date      date,
  p_end_date        date,
  p_conversation_id uuid
)
RETURNS TABLE (booking_id uuid, total_price numeric, status text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid;
  v_listing record;
  v_conv record;
  v_days int;
  v_discount numeric;
  v_total numeric;
  v_overlap_count int;
  v_new_id uuid;
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

  SELECT l.id, l.owner_id, l.price, l.deposit_amount, l.is_active
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

  SELECT count(*) INTO v_overlap_count
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

  IF v_overlap_count > 0 THEN
    RAISE EXCEPTION 'Selected dates overlap an existing booking' USING ERRCODE = '23505';
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
  v_total := round(v_listing.price * v_days * (1 - v_discount));

  INSERT INTO public.bookings (
    listing_id, renter_id, owner_id, status,
    start_date, end_date,
    total_price, deposit_amount, conversation_id
  )
  VALUES (
    p_listing_id, v_conv.requester_id, v_listing.owner_id, 'pending_payment',
    (p_start_date::text || ' 00:00:00')::timestamptz,
    (p_end_date::text   || ' 23:59:59')::timestamptz,
    v_total,
    COALESCE(v_listing.deposit_amount, 0),
    p_conversation_id
  )
  RETURNING bookings.id INTO v_new_id;

  RETURN QUERY
    SELECT b.id, b.total_price, b.status
      FROM public.bookings b
     WHERE b.id = v_new_id;
END;
$$;

REVOKE ALL ON FUNCTION public.create_booking_for_payment(uuid, date, date, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_booking_for_payment(uuid, date, date, uuid) TO authenticated;
