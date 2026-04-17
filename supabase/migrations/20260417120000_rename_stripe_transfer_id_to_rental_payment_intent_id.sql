-- Rename misleading column: stripe_transfer_id actually stores the rental
-- PaymentIntent ID, not a Stripe Transfer ID. Renaming for clarity and to
-- avoid confusion with stripe_payment_intent_id which stores the deposit
-- PaymentIntent ID.
ALTER TABLE public.bookings
  RENAME COLUMN stripe_transfer_id TO stripe_rental_payment_intent_id;
