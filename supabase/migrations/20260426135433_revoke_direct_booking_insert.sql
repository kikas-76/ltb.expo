/*
  # Block direct INSERT on bookings from the client

  Once create_booking_for_payment is the canonical creation path, we revoke
  the INSERT privilege on public.bookings from authenticated/anon. The
  service_role keeps INSERT for edge functions and migrations.

  We also drop the obsolete RLS INSERT policy that previously gated client
  inserts. Since the privilege is gone the policy is unreachable, but
  removing it makes the contract explicit.
*/

REVOKE INSERT ON public.bookings FROM authenticated, anon;

DROP POLICY IF EXISTS "Renter can create bookings" ON public.bookings;
