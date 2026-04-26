ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS deposit_hold_failed boolean DEFAULT false;
