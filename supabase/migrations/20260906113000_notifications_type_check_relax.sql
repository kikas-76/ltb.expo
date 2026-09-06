-- Le centre de notifications reçoit désormais tous les événements push
-- (booking_rejected, payment_confirmed_owner/renter, deposit_hold_failed_*,
-- booking_expired, review_received, dispute_opened, reminder_*, news…).
-- On remplace la liste fermée par une contrainte de forme.
alter table public.notifications drop constraint if exists notifications_type_check;
alter table public.notifications
  add constraint notifications_type_check check (type ~ '^[a-z][a-z0-9_]{0,63}$');
