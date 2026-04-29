/*
  # Harden disputes table — photo URI shape + one open dispute per booking
  (audit P2 — dispute flow)

  Two small invariants the disputes table didn't enforce:

  1. `photo_urls` accepts any text. The dispute UI persists
     `private://dispute-evidence/<path>` URIs that the admin viewer
     resolves through lib/signedUrl.ts; nothing in the schema prevents
     a reporter from inserting `https://attacker.com/...` and turning
     the admin dashboard into a tracking pixel canvas.

  2. No uniqueness on (booking_id, status='open'). Multiple open or
     under-review disputes can pile up on the same booking, splitting
     the admin workflow.

  Defenses
  --------
  - CHECK that every entry in photo_urls starts with the expected
    private bucket prefix (or is NULL/empty).
  - Partial unique index on booking_id for active dispute statuses.

  These are belt-and-suspenders; the proper RLS fix to scope INSERT to
  participants of the booking lives in a follow-up migration so each
  layer can be reviewed independently.
*/

-- 1. photo_urls shape
-- Postgres CHECK constraints don't accept subqueries (incl. unnest), so
-- the per-element check goes through an IMMUTABLE helper. Marked
-- IMMUTABLE because the result is fully determined by the input array
-- with no side state.
CREATE OR REPLACE FUNCTION public.disputes_photo_urls_valid(arr text[])
RETURNS boolean
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  u text;
BEGIN
  IF arr IS NULL OR cardinality(arr) = 0 THEN
    RETURN true;
  END IF;
  FOREACH u IN ARRAY arr LOOP
    IF u IS NULL OR u NOT LIKE 'private://dispute-evidence/%' THEN
      RETURN false;
    END IF;
  END LOOP;
  RETURN true;
END;
$$;

ALTER TABLE public.disputes
  DROP CONSTRAINT IF EXISTS disputes_photo_urls_private_only;

ALTER TABLE public.disputes
  ADD CONSTRAINT disputes_photo_urls_private_only
  CHECK (public.disputes_photo_urls_valid(photo_urls));

-- 2. One open dispute per booking. Status values we treat as "still
--    needs admin attention" → at most one row at a time.
DROP INDEX IF EXISTS disputes_one_open_per_booking;
CREATE UNIQUE INDEX disputes_one_open_per_booking
  ON public.disputes (booking_id)
  WHERE status IN ('open', 'under_review');
