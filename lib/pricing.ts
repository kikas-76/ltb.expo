export function getDiscount(days: number): number {
  if (days >= 7) return 0.2;
  if (days >= 3) return 0.1;
  return 0;
}

export function computeRentalTotal(pricePerDay: number, days: number): number {
  return Math.round(pricePerDay * days * (1 - getDiscount(days)));
}
