import { describe, expect, it } from 'vitest';
import { frenchError, looksFrench, GENERIC_ERROR, NETWORK_ERROR, SESSION_ERROR, PERMISSION_ERROR } from '@/lib/errorMessages';

describe('frenchError', () => {
  it('traduit les erreurs Supabase Auth par code', () => {
    expect(frenchError({ code: 'invalid_credentials', message: 'Invalid login credentials' })).toBe('E-mail ou mot de passe incorrect.');
    expect(frenchError({ code: 'same_password', message: 'New password should be different from the old password.' })).toBe(
      "Le nouveau mot de passe doit être différent de l'ancien.",
    );
    expect(frenchError({ code: 'weak_password', message: 'Password should contain…', reasons: ['characters'] })).toMatch(/^Mot de passe trop faible/);
    expect(frenchError({ code: 'weak_password', message: 'Password is known to be weak', reasons: ['pwned'] })).toBe(
      'Ce mot de passe est trop courant. Choisissez-en un autre.',
    );
  });

  it('traduit les anciens messages Auth sans code', () => {
    expect(frenchError(new Error('Invalid login credentials'))).toBe('E-mail ou mot de passe incorrect.');
    expect(frenchError({ message: 'Email not confirmed' })).toMatch(/pas encore confirmée/);
    expect(frenchError({ message: 'For security purposes, you can only request this after 42 seconds.' })).toBe(
      'Par sécurité, patientez 42 secondes avant de réessayer.',
    );
    expect(frenchError({ message: 'Email rate limit exceeded' })).toMatch(/^Trop d'e-mails/);
    expect(frenchError({ message: 'Auth session missing!' })).toBe(SESSION_ERROR);
  });

  it('traduit les erreurs réseau et de réponse', () => {
    expect(frenchError(new TypeError('Failed to fetch'))).toBe(NETWORK_ERROR);
    expect(frenchError({ message: 'TypeError: Network request failed' })).toBe(NETWORK_ERROR);
    expect(frenchError({ message: 'Load failed' })).toBe(NETWORK_ERROR);
    expect(frenchError(new SyntaxError('Unexpected token < in JSON at position 0'))).toMatch(/^Réponse inattendue/);
  });

  it('traduit les erreurs de base de données', () => {
    expect(frenchError({ code: '42501', message: 'new row violates row-level security policy for table "listings"' })).toBe(PERMISSION_ERROR);
    expect(frenchError({ code: '22001', message: 'value too long for type character varying(80)' })).toBe('Un des textes saisis est trop long.');
    expect(frenchError({ message: 'duplicate key value violates unique constraint "profiles_username_key"' })).toBe(
      'Cette information est déjà utilisée.',
    );
  });

  it('traduit nos messages serveur restés en anglais', () => {
    expect(frenchError({ code: 'P0001', message: 'start_date cannot be in the past' })).toMatch(/^Ces dates sont déjà passées/);
    expect(frenchError({ message: 'Listing is not active' })).toBe("Cette annonce n'est plus disponible.");
    expect(frenchError({ error: 'Unauthorized' })).toBe(SESSION_ERROR);
    expect(frenchError('Forbidden: admin only')).toBe(PERMISSION_ERROR);
    expect(frenchError({ message: 'report rate limit exceeded (10 per 24h)' })).toMatch(/10 signalements/);
  });

  it('garde les messages déjà en français', () => {
    const msg = 'Ce contenu contient des termes interdits par nos conditions d\'utilisation.';
    expect(frenchError({ code: 'P0001', message: msg })).toBe(msg);
    expect(frenchError(new Error('Session expirée'))).toBe('Session expirée');
    expect(frenchError({ error: 'Code invalide' })).toBe('Code invalide');
    expect(frenchError({ code: '23505', message: 'Stock insuffisant : il reste 1 unité(s) sur cette période' })).toMatch(/^Stock insuffisant/);
  });

  it("remplace l'anglais inconnu par le message de repli", () => {
    expect(frenchError(new Error('Something weird happened'))).toBe(GENERIC_ERROR);
    expect(frenchError({ message: 'Internal error' }, 'Enregistrement impossible.')).toBe('Enregistrement impossible.');
    expect(frenchError(null)).toBe(GENERIC_ERROR);
    expect(frenchError(undefined, 'Repli')).toBe('Repli');
  });
});

describe('looksFrench', () => {
  it('distingue le français de l\'anglais', () => {
    expect(looksFrench('Une erreur est survenue')).toBe(true);
    expect(looksFrench('Erreur interne')).toBe(true);
    expect(looksFrench('Internal error')).toBe(false);
    expect(looksFrench('Listing is not active')).toBe(false);
  });
});
