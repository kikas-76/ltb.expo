import { Platform } from 'react-native';
import type { Router } from 'expo-router';

/**
 * Où ramener l'utilisateur après connexion ou inscription.
 *
 * L'app se parcourt sans compte (exigence App Store 5.1.1(v)) : quand un
 * visiteur touche une action réservée aux comptes (réserver, favori, messages,
 * page privée), on retient l'écran d'où il vient puis on ouvre la connexion.
 * Une fois connecté (et onboardé pour un nouveau compte), il revient là.
 *
 * Mémoire du module sur natif ; sessionStorage en plus sur le web, car la
 * connexion Google y recharge la page.
 */

const KEY = 'ltb:auth_return';
// Ancienne clé de la page /book (web), encore lue pour ne rien perdre.
const LEGACY_KEY = 'pending_book_url';

// Jamais de retour vers un écran d'authentification ou d'onboarding.
const EXCLUDED_PREFIXES = [
  '/login',
  '/register',
  '/verify-email',
  '/email-confirmed',
  '/auth-callback',
  '/link-google-account',
  '/forgot-password',
  '/reset-password',
  '/onboarding',
];

let memory: string | null = null;

// « J'aime » touché par un visiteur : appliqué automatiquement une fois connecté
// (FavoritesContext). Mémoire seule : une connexion Google web recharge la page
// et l'oublie, sans gravité.
let pendingFavorite: { listingId: string; listingName?: string } | null = null;

function webStorage(): Storage | null {
  try {
    if (Platform.OS === 'web' && typeof window !== 'undefined' && window.sessionStorage) {
      return window.sessionStorage;
    }
  } catch {}
  return null;
}

/** Chemin interne relatif uniquement (pas d'URL absolue : garde anti open-redirect). */
function sanitize(path: string | null | undefined): string | null {
  if (typeof path !== 'string') return null;
  if (!path.startsWith('/') || path.startsWith('//')) return null;
  // « / » est la landing : l'accueil des onglets est « /(tabs) ».
  if (path === '/' || path === '/index') return '/(tabs)';
  if (EXCLUDED_PREFIXES.some((p) => path === p || path.startsWith(p + '/') || path.startsWith(p + '?'))) {
    return null;
  }
  return path;
}

export function setAuthReturnPath(path: string | null) {
  memory = sanitize(path);
  // Nouvelle intention : l'éventuel « j'aime » en attente ne la concerne plus.
  pendingFavorite = null;
  const s = webStorage();
  try {
    if (s) {
      if (memory) s.setItem(KEY, memory);
      else s.removeItem(KEY);
      s.removeItem(LEGACY_KEY);
    }
  } catch {}
}

export function takeAuthReturnPath(): string | null {
  let path = memory;
  memory = null;
  const s = webStorage();
  try {
    if (s) {
      path = path ?? s.getItem(KEY) ?? s.getItem(LEGACY_KEY);
      s.removeItem(KEY);
      s.removeItem(LEGACY_KEY);
    }
  } catch {}
  return sanitize(path);
}

export function clearAuthReturnPath() {
  memory = null;
  const s = webStorage();
  try {
    if (s) {
      s.removeItem(KEY);
      s.removeItem(LEGACY_KEY);
    }
  } catch {}
}

export function setPendingFavorite(listingId: string, listingName?: string) {
  pendingFavorite = { listingId, listingName };
}

export function takePendingFavorite() {
  const f = pendingFavorite;
  pendingFavorite = null;
  return f;
}

export function clearPendingFavorite() {
  pendingFavorite = null;
}

/**
 * Quitte l'écran de connexion / d'onboarding vers l'écran retenu. `dismissTo`
 * dépile jusqu'à l'écran d'origine s'il est encore dans la pile (l'état est
 * conservé, par exemple les dates choisies sur une annonce), sinon l'ouvre.
 */
export function navigateAfterAuth(router: Router, fallback = '/(tabs)') {
  const target = takeAuthReturnPath() ?? fallback;
  if (router.canGoBack()) {
    router.dismissTo(target as any);
  } else {
    router.replace(target as any);
  }
}
