export function getDiscount(days: number): number {
  if (days >= 7) return 0.2;
  if (days >= 3) return 0.1;
  return 0;
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
