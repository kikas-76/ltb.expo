/*
  # Add stripe_customer_id to profiles

  1. Changes
    - `profiles`: adds `stripe_customer_id` (text, nullable)
      Used to store the Stripe Customer ID so a PaymentMethod can be reused
      across multiple PaymentIntents (rental + deposit) without being rejected by Stripe.

  2. Notes
    - No RLS change needed; existing policies cover this column automatically.
*/

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'stripe_customer_id'
  ) THEN
    ALTER TABLE profiles ADD COLUMN stripe_customer_id text;
  END IF;
END $$;
