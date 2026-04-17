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

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    storage,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: Platform.OS === 'web',
  },
});
