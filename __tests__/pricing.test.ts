import { describe, expect, it } from 'vitest';
import { computeRentalTotal, getDiscount } from '@/lib/pricing';

describe('getDiscount', () => {
  it('returns 0 for short rentals (1-2 days)', () => {
    expect(getDiscount(1)).toBe(0);
    expect(getDiscount(2)).toBe(0);
  });

  it('returns 10% from 3 days', () => {
    expect(getDiscount(3)).toBe(0.1);
    expect(getDiscount(6)).toBe(0.1);
  });

  it('returns 20% from 7 days', () => {
    expect(getDiscount(7)).toBe(0.2);
    expect(getDiscount(30)).toBe(0.2);
  });

  it('handles 0 days as no discount', () => {
    expect(getDiscount(0)).toBe(0);
  });
});

describe('computeRentalTotal', () => {
  it('multiplies price by days when no discount applies', () => {
    expect(computeRentalTotal(20, 1)).toBe(20);
    expect(computeRentalTotal(20, 2)).toBe(40);
  });

  it('applies 10% discount from 3 days', () => {
    expect(computeRentalTotal(20, 3)).toBe(54);
    expect(computeRentalTotal(100, 5)).toBe(450);
  });

  it('applies 20% discount from 7 days', () => {
    expect(computeRentalTotal(20, 7)).toBe(112);
    expect(computeRentalTotal(100, 10)).toBe(800);
  });

  it('rounds to nearest integer', () => {
    expect(computeRentalTotal(33.33, 1)).toBe(33);
    expect(computeRentalTotal(33.33, 3)).toBe(90);
  });

  it('returns 0 when days is 0', () => {
    expect(computeRentalTotal(50, 0)).toBe(0);
  });
});
