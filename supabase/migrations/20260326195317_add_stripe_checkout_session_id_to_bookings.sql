/*
  # Add stripe_checkout_session_id to bookings

  1. Changes
    - Adds `stripe_checkout_session_id` column to `bookings` table
      - Stores the Stripe Checkout Session ID for web payment flow
      - Nullable since mobile payments use PaymentIntents instead
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'bookings' AND column_name = 'stripe_checkout_session_id'
  ) THEN
    ALTER TABLE bookings ADD COLUMN stripe_checkout_session_id text;
  END IF;
END $$;
