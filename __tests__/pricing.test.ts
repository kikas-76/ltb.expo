import { describe, expect, it } from 'vitest';
import { computeRentalTotal, getDiscount, getRentalDays } from '@/lib/pricing';

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

describe('getRentalDays', () => {
  it('returns 0 for the same day (single-date selection is invalid)', () => {
    expect(getRentalDays('2026-04-23', '2026-04-23')).toBe(0);
  });

  it('returns 1 when picking next day (hotel model: check-in + check-out)', () => {
    expect(getRentalDays('2026-04-23', '2026-04-24')).toBe(1);
  });

  it('returns 7 for a full week span', () => {
    expect(getRentalDays('2026-04-23', '2026-04-30')).toBe(7);
  });

  it('handles DST spring-forward (23-hour day) as 1 day', () => {
    expect(getRentalDays('2026-03-28', '2026-03-29')).toBe(1);
  });

  it('handles DST fall-back (25-hour day) as 1 day', () => {
    expect(getRentalDays('2026-10-24', '2026-10-25')).toBe(1);
  });

  it('clamps inverted order to 0 instead of negative', () => {
    expect(getRentalDays('2026-04-25', '2026-04-23')).toBe(0);
  });

  it('accepts Date objects', () => {
    const start = new Date('2026-04-23T00:00:00');
    const end = new Date('2026-04-24T00:00:00');
    expect(getRentalDays(start, end)).toBe(1);
  });

  it('mirrors the bookings storage shape (T00:00:00 -> T23:59:59 same day ~= 1)', () => {
    expect(getRentalDays('2026-04-23T00:00:00', '2026-04-23T23:59:59')).toBe(1);
  });

  it('handles a long rental (365 days)', () => {
    expect(getRentalDays('2026-01-01', '2027-01-01')).toBe(365);
  });
});
