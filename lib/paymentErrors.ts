// Translates Stripe / network error messages to French. Stripe returns
// English by default for many decline reasons; we surface friendlier
// French copy and fall back to a generic message for unknown errors.
export function translatePaymentError(err: unknown): string {
  const raw = String((err as any)?.message ?? err ?? '').trim();
  if (!raw) return 'Erreur de paiement. Réessaie ou utilise une autre carte.';

  const m = raw.toLowerCase();

  if (m.includes('declined')) return 'Votre carte a été refusée. Vérifiez les informations ou utilisez une autre carte.';
  if (m.includes('insufficient')) return 'Fonds insuffisants sur la carte.';
  if (m.includes('expired')) return 'Carte expirée. Utilisez une autre carte.';
  if (m.includes('cvc') || m.includes('cvv') || m.includes('security code')) return 'Code de sécurité (CVC) incorrect.';
  if (m.includes('incorrect_number') || m.includes('invalid card number') || m.includes('invalid_number')) return 'Numéro de carte invalide.';
  if (m.includes('processing_error') || m.includes('processing error')) return 'Erreur de traitement par la banque. Réessaie dans quelques instants.';
  if (m.includes('authentication') || m.includes('3d secure') || m.includes('3ds')) return 'Authentification 3D Secure échouée. Réessaie ou utilise une autre carte.';
  if (m.includes('network') || m.includes('failed to fetch') || m.includes('timeout')) return 'Problème de connexion. Vérifie ta connexion et réessaie.';

  // If the message already looks French, pass it through.
  if (/[éèàêâîôûçÉÈÀ]/.test(raw)) return raw;

  return 'Erreur de paiement. Réessaie ou utilise une autre carte.';
}
