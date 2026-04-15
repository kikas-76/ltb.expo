/*
  # Add pending_payment booking status and migrate legacy accepted rows

  ## Summary
  This migration introduces "pending_payment" as the canonical booking status for
  bookings that have been owner-accepted but not yet paid. It safely migrates any
  existing "accepted" bookings that have no Stripe payment intent recorded
  (i.e. genuinely unpaid) to "pending_payment".

  ## Changes

  ### bookings table
  - Existing rows: any booking with status = 'accepted' AND no stripe_payment_intent_id
    is updated to status = 'pending_payment'.
  - Bookings that already have a stripe_payment_intent_id and status = 'accepted'
    are left untouched (edge case: old paid bookings that were never transitioned to 'active').

  ## Notes
  - No destructive operations are performed.
  - The UI already treats legacy "accepted" as payable; this migration brings
    the data in line with the new model.
  - No CHECK constraint exists on bookings.status (it is a plain text column),
    so no constraint change is needed.
*/

UPDATE bookings
SET status = 'pending_payment'
WHERE status = 'accepted'
  AND (stripe_payment_intent_id IS NULL OR stripe_payment_intent_id = '');
