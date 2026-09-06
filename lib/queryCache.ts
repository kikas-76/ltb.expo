import { Platform } from 'react-native';

/**
 * Cache local « stale-while-revalidate » pour les données d'écran.
 *
 * Le compute Supabase répond en 0,4 à 1 s par requête : on affiche donc
 * immédiatement la dernière réponse connue, puis on la remplace par la réponse
 * fraîche quand elle arrive. Mémoire pour la session, AsyncStorage (natif) ou
 * localStorage (web) pour survivre au redémarrage.
 */
const PREFIX = 'ltb:cache:v1:';
const memory = new Map<string, unknown>();

interface KVStorage {
  getItem(key: string): Promise<string | null>;
  setItem(key: string, value: string): Promise<void>;
  removeItem(key: string): Promise<void>;
}

let storage: KVStorage | null = null;
if (Platform.OS === 'web') {
  if (typeof localStorage !== 'undefined') {
    storage = {
      getItem: async (k) => localStorage.getItem(k),
      setItem: async (k, v) => { localStorage.setItem(k, v); },
      removeItem: async (k) => { localStorage.removeItem(k); },
    };
  }
} else {
  try {
    storage = require('@react-native-async-storage/async-storage').default;
  } catch {
    storage = null;
  }
}

export async function readCache<T>(key: string): Promise<T | null> {
  if (memory.has(key)) return memory.get(key) as T;
  if (!storage) return null;
  try {
    const raw = await storage.getItem(PREFIX + key);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as { t: number; v: T };
    memory.set(key, parsed.v);
    return parsed.v;
  } catch {
    return null;
  }
}

export async function writeCache<T>(key: string, value: T): Promise<void> {
  memory.set(key, value);
  if (!storage) return;
  try {
    await storage.setItem(PREFIX + key, JSON.stringify({ t: Date.now(), v: value }));
  } catch {
    // quota plein ou stockage indisponible : le cache est un bonus, pas une dépendance
  }
}

export async function clearCache(key: string): Promise<void> {
  memory.delete(key);
  if (!storage) return;
  try { await storage.removeItem(PREFIX + key); } catch {}
}
