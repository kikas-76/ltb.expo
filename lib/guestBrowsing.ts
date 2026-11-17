/**
 * Web : la landing (« / ») et l'accueil des onglets partagent la même URL. Un
 * visiteur qui a déjà parcouru les annonces dans cet onglet du navigateur y
 * revient au rafraîchissement, au lieu de retomber sur la landing.
 */
const EXPLORE_FLAG_KEY = 'ltb:explore';

export function markExplored() {
  try {
    if (typeof window !== 'undefined') window.sessionStorage?.setItem(EXPLORE_FLAG_KEY, '1');
  } catch {}
}

export function hasExplored(): boolean {
  try {
    return typeof window !== 'undefined' && window.sessionStorage?.getItem(EXPLORE_FLAG_KEY) === '1';
  } catch {
    return false;
  }
}
