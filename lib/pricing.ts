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

// Pro listings can have stock > 1 and an optional pack list. The total
// scales linearly with quantity. Stays consistent with the server-side
// formula in the create_booking_for_payment RPC.
export function computeRentalTotalWithQty(
  pricePerDay: number,
  days: number,
  quantity: number,
): number {
  const qty = Math.max(1, Math.floor(quantity || 1));
  return Math.round(pricePerDay * qty * days * (1 - getDiscount(days)));
}

// Validates that a quantity is allowed by a (stock_count, packs) pair.
// `packs` null/undefined means "any qty between 1 and stock_count".
export function isValidQuantity(
  qty: number,
  stockCount: number,
  packs: number[] | null | undefined,
): boolean {
  if (!Number.isFinite(qty) || qty < 1 || qty > stockCount) return false;
  if (Array.isArray(packs) && packs.length > 0) return packs.includes(qty);
  return true;
}

export const DEFAULT_OWNER_COMMISSION_PERCENT = 8;

// Stripe is the source of truth for actual payouts; this is an estimate for UI.
export function computeOwnerEarnings(totalPrice: number, commissionPercent?: number): number {
  const pct = commissionPercent ?? DEFAULT_OWNER_COMMISSION_PERCENT;
  return Number(totalPrice) * (1 - pct / 100);
}
