/*
  # Lock down bookings UPDATE/DELETE (audit P0 #1)

  Background
  ----------
  After the price-tampering fix (20260426130001) we revoked INSERT and
  forced creation through create_booking_for_payment, which recomputes
  total_price server-side. But UPDATE and DELETE were left open for
  authenticated:

  - "Admin update bookings" policy in fact allowed
      (jwt.app_metadata.role = 'admin') OR auth.uid() = renter_id OR auth.uid() = owner_id
    — i.e. any participant could UPDATE any column of their own booking.
    A renter could `update({ total_price: 1 }).eq('id', booking_id)` and
    then call create-payment-intent which reads booking.total_price → 1€
    rental for what should be 700€.

  - "Owner or renter can delete booking" let either side wipe the row
    along with its payment, deposit and dispute history.

  This migration closes the side door:
  - REVOKE UPDATE, DELETE on public.bookings from anon and authenticated.
  - Drop the two participant policies. They are unreachable now (no
    privilege left to gate) and their presence misleads future readers.
  - service_role keeps full access (edge functions still need to flip
    status on payment success, store stripe_*_payment_intent_id, etc.).
  - The update_booking_status RPC is SECURITY DEFINER, so it keeps
    working: it runs as postgres regardless of the caller's grants and
    enforces the transition matrix server-side.

  Verified beforehand: zero `from('bookings').update(...)` or
  `from('bookings').delete(...)` call sites in the app — every booking
  state change either goes through the RPC or is run from an edge
  function with the service role.

  Tested post-deploy:
    T1 authenticated UPDATE bookings → 42501 permission denied
    T2 authenticated DELETE bookings → 42501 permission denied
    T3 authenticated update_booking_status RPC → still callable
       (returns 'Booking not found' for the test uuid, proving the
       SECURITY DEFINER path bypasses the new revoke).
*/

REVOKE UPDATE, DELETE ON public.bookings FROM anon, authenticated;

DROP POLICY IF EXISTS "Admin update bookings" ON public.bookings;
DROP POLICY IF EXISTS "Owner or renter can delete booking" ON public.bookings;
