-- C2 : Ajouter display_name à profiles
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS display_name text;

-- Remplir avec username pour les profils existants
UPDATE public.profiles
SET display_name = username
WHERE display_name IS NULL AND username IS NOT NULL;

-- C3 : Ajouter les colonnes deposit manquantes à bookings
ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS deposit_authorized_at timestamptz,
  ADD COLUMN IF NOT EXISTS deposit_captured_at timestamptz;
