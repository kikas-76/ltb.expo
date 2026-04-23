export function getDiscount(days: number): number {
  if (days >= 7) return 0.2;
  if (days >= 3) return 0.1;
  return 0;
}

// Hotel model: picking J and J+1 on the calendar = 1 day of rental.
// Returns 0 for same-day or inverted inputs so UI can force a valid range.
export function getRentalDays(start: string | Date, end: string | Date): number {
  const s = typeof start === 'string' ? new Date(start).getTime() : start.getTime();
  const e = typeof end === 'string' ? new Date(end).getTime() : end.getTime();
  return Math.max(0, Math.round((e - s) / 86400000));
}

export function computeRentalTotal(pricePerDay: number, days: number): number {
  return Math.round(pricePerDay * days * (1 - getDiscount(days)));
}

export const DEFAULT_OWNER_COMMISSION_PERCENT = 8;

// Stripe is the source of truth for actual payouts; this is an estimate for UI.
export function computeOwnerEarnings(totalPrice: number, commissionPercent?: number): number {
  const pct = commissionPercent ?? DEFAULT_OWNER_COMMISSION_PERCENT;
  return Number(totalPrice) * (1 - pct / 100);
}
