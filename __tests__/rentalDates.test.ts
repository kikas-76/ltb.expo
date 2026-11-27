import { afterEach, describe, expect, it } from 'vitest';
import { formatRentalDate, rentalDay } from '@/lib/rentalDates';

const ORIGINAL_TZ = process.env.TZ;
afterEach(() => {
  process.env.TZ = ORIGINAL_TZ;
});

// Fuseaux du téléphone : France, très à l'est et très à l'ouest de UTC.
const ZONES = ['Europe/Paris', 'Pacific/Auckland', 'America/Los_Angeles', 'UTC'];

describe('rentalDay', () => {
  it.each(ZONES)('garde le jour de fin d\'une réservation (23:59:59 UTC) en %s', (tz) => {
    process.env.TZ = tz;
    const d = rentalDay('2026-12-21T23:59:59+00:00');
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2026, 12, 21]);
  });

  it.each(ZONES)('garde le jour de début (00:00:00 UTC) en %s', (tz) => {
    process.env.TZ = tz;
    const d = rentalDay('2026-12-20T00:00:00+00:00');
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2026, 12, 20]);
  });

  it.each(ZONES)('garde une date seule de conversation en %s', (tz) => {
    process.env.TZ = tz;
    const d = rentalDay('2026-12-28');
    expect([d.getFullYear(), d.getMonth() + 1, d.getDate()]).toEqual([2026, 12, 28]);
  });
});

describe('formatRentalDate', () => {
  it('affiche la vraie date de fin à Paris (bug « 20 au 22 décembre »)', () => {
    process.env.TZ = 'Europe/Paris';
    expect(formatRentalDate('2026-12-21T23:59:59+00:00')).toBe('21 décembre 2026');
  });

  it('accepte un autre format', () => {
    process.env.TZ = 'Europe/Paris';
    expect(formatRentalDate('2026-12-21T23:59:59+00:00', { day: 'numeric', month: 'short' })).toBe('21 déc.');
  });

  it('renvoie une chaîne vide pour une date invalide', () => {
    expect(formatRentalDate('pas une date')).toBe('');
  });
});
