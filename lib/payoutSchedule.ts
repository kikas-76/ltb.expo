// Single source of truth for the payout cadence shown to owners.
// Stripe Connect is configured with delay_days = 14 in the create-connect
// edge function; this constant matches that and feeds every UI label and
// "next payout in X days" estimate so they stay consistent if the cadence
// is ever changed.
export const PAYOUT_INTERVAL_DAYS = 14;
export const PAYOUT_INTERVAL_LABEL = `${PAYOUT_INTERVAL_DAYS} jours`;
