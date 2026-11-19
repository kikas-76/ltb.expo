// Adresses françaises via la Géoplateforme de l'IGN (ex-API Adresse) :
// gratuite, sans clé, appelable depuis le navigateur. Utilisée là où le proxy
// Google Maps n'est pas disponible (il exige une session), comme le lien
// /publier pour les visiteurs.

const BASE = 'https://data.geopf.fr/geocodage';

export interface FrenchAddress {
  label: string;
  city: string | null;
  postcode: string | null;
  lat: number;
  lng: number;
}

function toAddress(feature: any): FrenchAddress | null {
  const [lng, lat] = feature?.geometry?.coordinates ?? [];
  const p = feature?.properties ?? {};
  if (typeof lat !== 'number' || typeof lng !== 'number' || !p.label) return null;
  return { label: p.label, city: p.city ?? null, postcode: p.postcode ?? null, lat, lng };
}

async function query(url: string, signal?: AbortSignal): Promise<FrenchAddress[]> {
  const res = await fetch(url, { signal });
  if (!res.ok) throw new Error(`geocodage ${res.status}`);
  const json = await res.json();
  return ((json?.features ?? []) as any[]).map(toAddress).filter((a): a is FrenchAddress => a !== null);
}

/** Suggestions pendant la saisie (adresse, rue ou ville). */
export function searchFrenchAddresses(text: string, signal?: AbortSignal): Promise<FrenchAddress[]> {
  const q = text.trim();
  if (q.length < 3) return Promise.resolve([]);
  return query(`${BASE}/search?q=${encodeURIComponent(q)}&autocomplete=1&limit=5`, signal);
}

/** Adresse la plus proche d'une position GPS. */
export async function reverseFrenchAddress(lat: number, lng: number): Promise<FrenchAddress | null> {
  const results = await query(`${BASE}/reverse?lat=${lat}&lon=${lng}&limit=1`);
  return results[0] ?? null;
}
