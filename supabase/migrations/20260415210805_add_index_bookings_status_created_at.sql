/*
  # Add index on bookings(status, created_at)

  ## Purpose
  Optimizes the query used by the expire-stale-pending-payments edge function,
  which filters bookings by status = 'pending_payment' and created_at < cutoff timestamp.

  ## Changes
  - Adds a composite index on bookings(status, created_at) for fast lookups
    when scanning for stale pending_payment bookings older than 30 minutes.
*/

CREATE INDEX IF NOT EXISTS idx_bookings_status_created_at
  ON bookings (status, created_at);
