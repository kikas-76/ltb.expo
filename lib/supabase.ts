import { createClient } from '@supabase/supabase-js';
import { Platform } from 'react-native';
import 'react-native-url-polyfill/auto';

const supabaseUrl = process.env.EXPO_PUBLIC_SUPABASE_URL;
const supabaseAnonKey = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY;

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error(
    'Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY. ' +
    'Copy .env.example to .env and fill in the Supabase values, then restart the bundler.'
  );
}

if (!process.env.EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY) {
  console.warn('[env] EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY is missing. Payment screens will fail.');
}
if (!process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY) {
  console.warn('[env] EXPO_PUBLIC_GOOGLE_MAPS_KEY is missing. Maps and address autocomplete will fail.');
}

let storage: any = undefined;
if (Platform.OS !== 'web') {
  try {
    storage = require('@react-native-async-storage/async-storage').default;
  } catch {}
}

// Délai d'attente réseau : sans lui, un serveur injoignable laisse l'app charger
// indéfiniment (iOS n'abandonne un fetch qu'après ~60 s). 15 s pour l'API,
// 45 s pour les envois de fichiers vers le storage.
const fetchWithTimeout: typeof fetch = (input, init) => {
  const url = typeof input === 'string' ? input : ((input as any)?.url ?? String(input));
  const ms = url.includes('/storage/v1/') ? 45000 : 15000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), ms);
  const upstream = init?.signal;
  if (upstream) {
    if (upstream.aborted) controller.abort();
    else upstream.addEventListener('abort', () => controller.abort(), { once: true });
  }
  return fetch(input, { ...init, signal: controller.signal }).finally(() => clearTimeout(timer));
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
  global: { fetch: fetchWithTimeout },
});
