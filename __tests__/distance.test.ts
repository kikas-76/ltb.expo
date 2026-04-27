import { describe, expect, it } from 'vitest';
import { haversineKm, formatDistance } from '@/lib/distance';

describe('haversineKm', () => {
  it('returns 0 for identical points', () => {
    expect(haversineKm(48.8566, 2.3522, 48.8566, 2.3522)).toBe(0);
  });

  it('Paris ↔ Lyon ≈ 391 km (within 1%)', () => {
    const km = haversineKm(48.8566, 2.3522, 45.7640, 4.8357);
    expect(km).toBeGreaterThan(388);
    expect(km).toBeLessThan(395);
  });

  it('Paris ↔ Marseille ≈ 661 km (within 1%)', () => {
    const km = haversineKm(48.8566, 2.3522, 43.2965, 5.3698);
    expect(km).toBeGreaterThan(656);
    expect(km).toBeLessThan(666);
  });

  it('antipodes ≈ half the equator', () => {
    const km = haversineKm(0, 0, 0, 180);
    // ~20015 km — within 0.5%
    expect(km).toBeGreaterThan(19915);
    expect(km).toBeLessThan(20115);
  });

  it('symmetric (A→B == B→A)', () => {
    const ab = haversineKm(48.8566, 2.3522, 45.7640, 4.8357);
    const ba = haversineKm(45.7640, 4.8357, 48.8566, 2.3522);
    expect(ab).toBeCloseTo(ba, 6);
  });
});

describe('formatDistance', () => {
  it('renders sub-kilometre values in metres', () => {
    expect(formatDistance(0.4)).toBe('400 m');
    expect(formatDistance(0.05)).toBe('50 m');
    expect(formatDistance(0.999)).toBe('999 m');
  });

  it('renders 1–10 km with one decimal', () => {
    expect(formatDistance(1.234)).toBe('1.2 km');
    expect(formatDistance(5)).toBe('5.0 km');
    expect(formatDistance(9.4)).toBe('9.4 km');
  });

  it('rounds ≥10 km to integer', () => {
    expect(formatDistance(12.4)).toBe('12 km');
    expect(formatDistance(12.6)).toBe('13 km');
    expect(formatDistance(391)).toBe('391 km');
  });

  it('handles zero', () => {
    expect(formatDistance(0)).toBe('0 m');
  });
});
