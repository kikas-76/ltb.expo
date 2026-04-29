/*
  # Prevent overlapping active bookings on the same listing
  (audit P2 — calendar race condition)

  Background
  ----------
  create_booking_for_payment runs `SELECT count(*)` then `INSERT` with
  no row lock and no exclusion constraint. Postgres' default isolation
  is READ COMMITTED, so two concurrent calls (two browsers, two clicks
  in the same instant) can both see count=0 and both insert. Result:
  two paid bookings on the same listing for the same dates.

  Fix
  ---
  Declarative exclusion constraint at the table level. Catches the
  race regardless of which code path inserts (RPC, edge function with
  service_role, future admin tool, …). Scoped to the same status set
  the RPC already uses for its overlap check, so cancelled / refused /
  expired / completed bookings free the slot.

  Requires `btree_gist` because the `=` operator on uuid (listing_id)
  isn't part of gist's default operator class — btree_gist adds it.

  Existing data
  -------------
  The constraint creation will fail if production already contains
  overlapping rows. We don't expect any (the RPC's overlap check
  prevented honest overlaps), but the migration is wrapped so an
  attentive operator can resolve any pre-existing conflict before
  re-running. If it fails, query:

      SELECT a.id, b.id, a.listing_id, a.start_date, a.end_date
        FROM bookings a JOIN bookings b
          ON a.listing_id = b.listing_id AND a.id < b.id
       WHERE a.status IN (...) AND b.status IN (...)
         AND tstzrange(a.start_date, a.end_date, '[)')
             && tstzrange(b.start_date, b.end_date, '[)');

  …and decide which to keep before re-running.
*/

CREATE EXTENSION IF NOT EXISTS btree_gist;

ALTER TABLE public.bookings
  DROP CONSTRAINT IF EXISTS bookings_no_overlap_active;

ALTER TABLE public.bookings
  ADD CONSTRAINT bookings_no_overlap_active
  EXCLUDE USING gist (
    listing_id WITH =,
    tstzrange(start_date, end_date, '[)') WITH &&
  )
  WHERE (
    status IN (
      'pending_payment', 'active', 'in_progress',
      'pending_return', 'pending_owner_validation', 'disputed'
    )
  );

-- The existing create_booking_for_payment RPC keeps its own count-based
-- overlap check; that check now runs *before* the EXCLUDE constraint
-- and produces a friendlier error (RAISE EXCEPTION ... ERRCODE 23505).
-- The EXCLUDE constraint is the actual race-safe gate: two concurrent
-- inserts that both pass the count check will collide here and the
-- loser gets exclusion_violation (23P01). Future direct inserts (e.g.
-- from a service_role edge function or admin tool) are also covered.
