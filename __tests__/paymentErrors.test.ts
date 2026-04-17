import { describe, expect, it } from 'vitest';
import { translatePaymentError } from '@/lib/paymentErrors';

describe('translatePaymentError', () => {
  it('translates declined cards', () => {
    expect(translatePaymentError(new Error('Your card was declined.'))).toMatch(/refusée/);
  });

  it('translates insufficient funds', () => {
    expect(translatePaymentError(new Error('Your card has insufficient funds.'))).toMatch(/insuffisants/);
  });

  it('translates expired card', () => {
    expect(translatePaymentError(new Error('Your card has expired.'))).toMatch(/expirée/i);
  });

  it('translates CVC error', () => {
    expect(translatePaymentError(new Error('Your card security code (CVC) is incorrect.'))).toMatch(/sécurité/);
  });

  it('falls back to generic on unknown English errors', () => {
    expect(translatePaymentError(new Error('Some random Stripe gibberish'))).toMatch(/réessaie/i);
  });

  it('passes French messages through unchanged', () => {
    expect(translatePaymentError(new Error('Réservation introuvable')))
      .toBe('Réservation introuvable');
  });

  it('handles null / undefined / empty', () => {
    expect(translatePaymentError(null)).toBeTruthy();
    expect(translatePaymentError(undefined)).toBeTruthy();
    expect(translatePaymentError({})).toBeTruthy();
    expect(translatePaymentError(new Error(''))).toBeTruthy();
  });
});
