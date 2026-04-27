import { describe, expect, it } from 'vitest';
import { extractCityFromAddress } from '@/lib/address';

describe('extractCityFromAddress', () => {
  it('extracts the city out of a French Google-style address', () => {
    expect(
      extractCityFromAddress('1 Rue de Rivoli, 75001 Paris, France'),
    ).toBe('Paris');
  });

  it('strips a 5-digit postal code', () => {
    expect(extractCityFromAddress('Avenue X, 13001 Marseille, France')).toBe(
      'Marseille',
    );
  });

  it('strips a longer postal code if present', () => {
    expect(
      extractCityFromAddress('Some Street, 123456 Bigtown, Country'),
    ).toBe('Bigtown');
  });

  it('keeps the city when there is no postal code prefix', () => {
    expect(extractCityFromAddress('Place X, Reims, France')).toBe('Reims');
  });

  it('keeps multi-word city names', () => {
    expect(
      extractCityFromAddress('Rue X, 38000 Saint-Martin-d\'Hères, France'),
    ).toBe("Saint-Martin-d'Hères");
  });

  it('returns null when the input is missing', () => {
    expect(extractCityFromAddress(null)).toBeNull();
    expect(extractCityFromAddress(undefined)).toBeNull();
    expect(extractCityFromAddress('')).toBeNull();
  });

  it('returns null for a single-segment address', () => {
    expect(extractCityFromAddress('Paris')).toBeNull();
  });

  it('trims whitespace', () => {
    expect(extractCityFromAddress('Rue X,   75001 Paris  , France')).toBe(
      'Paris',
    );
  });
});
