/*
  # Stock & packs : annonces pro multi-unités

  Aujourd'hui chaque listing représente UNE unité indivisible. Un loueur
  pro qui possède 25 chaises identiques devait créer 25 annonces. Avec
  cette migration, il déclare un stock total et (optionnellement) une
  liste de quantités autorisées (packs).

  Ajouts :
  - listings.stock_count int NOT NULL DEFAULT 1
  - listings.packs jsonb (NULL = locataire libre 1..stock_count, sinon
    array d'entiers triés ASC, ex. [1,5,10,25])
  - bookings.quantity int NOT NULL DEFAULT 1 (nombre d'unités sur cette
    location, multiplie le total_price linéairement)
  - conversations.quantity int NOT NULL DEFAULT 1 (la quantité demandée
    vit sur la conversation pré-acceptation aussi)

  Contraintes shape uniquement (>= 1 partout, packs is array). La validation
  fine (packs = entiers positifs sortés) est faite côté RPC + côté UI
  parce que Postgres ne permet pas de subquery dans CHECK.
*/

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS stock_count int NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS packs jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.listings'::regclass
      AND conname = 'listings_stock_count_positive'
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT listings_stock_count_positive CHECK (stock_count >= 1);
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.listings'::regclass
      AND conname = 'listings_packs_is_array'
  ) THEN
    ALTER TABLE public.listings
      ADD CONSTRAINT listings_packs_is_array
      CHECK (packs IS NULL OR jsonb_typeof(packs) = 'array');
  END IF;
END $$;

ALTER TABLE public.bookings
  ADD COLUMN IF NOT EXISTS quantity int NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.bookings'::regclass
      AND conname = 'bookings_quantity_positive'
  ) THEN
    ALTER TABLE public.bookings
      ADD CONSTRAINT bookings_quantity_positive CHECK (quantity >= 1);
  END IF;
END $$;

ALTER TABLE public.conversations
  ADD COLUMN IF NOT EXISTS quantity int NOT NULL DEFAULT 1;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.conversations'::regclass
      AND conname = 'conversations_quantity_positive'
  ) THEN
    ALTER TABLE public.conversations
      ADD CONSTRAINT conversations_quantity_positive CHECK (quantity >= 1);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_bookings_listing_active_window
  ON public.bookings (listing_id, start_date, end_date)
  WHERE status IN ('pending_payment','active','in_progress','pending_return','pending_owner_validation','disputed');
