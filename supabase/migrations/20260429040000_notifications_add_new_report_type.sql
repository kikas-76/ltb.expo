/*
  # Allow `new_report` in notifications.type

  The reports_notify_admins trigger (20260429030000) writes a
  notifications row of `type='new_report'` for every admin profile when
  a report is filed. The original notifications.type CHECK didn't
  include that value, so the trigger raised 23514 and rolled back the
  whole INSERT — i.e. reports stopped being insertable at all.

  Add `'new_report'` to the allowed set; leave the rest untouched.
*/

ALTER TABLE public.notifications DROP CONSTRAINT IF EXISTS notifications_type_check;
ALTER TABLE public.notifications
  ADD CONSTRAINT notifications_type_check
  CHECK (type = ANY (ARRAY[
    'booking_request',
    'booking_accepted',
    'booking_refused',
    'booking_cancelled',
    'booking_completed',
    'payment_received',
    'payment_confirmed',
    'deposit_released',
    'deposit_captured',
    'new_message',
    'new_review',
    'listing_reported',
    'account_warning',
    'system',
    'new_report'
  ]));
