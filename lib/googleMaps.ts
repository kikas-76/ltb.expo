import { Platform } from 'react-native';
import { supabase } from '@/lib/supabase';

const GOOGLE_MAPS_KEY = process.env.EXPO_PUBLIC_GOOGLE_MAPS_KEY as string;
const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY as string;

const PROXY_BASE = `${SUPABASE_URL}/functions/v1/maps-proxy`;

export interface PlaceSuggestion {
  place_id: string;
  description: string;
  structured_formatting: {
    main_text: string;
    secondary_text: string;
  };
}

export interface PlaceDetails {
  address: string;
  lat: number;
  lng: number;
  city: string | null;
}

// Google Places / Geocoding response shapes (only the fields we read).
interface AddressComponent {
  long_name: string;
  short_name: string;
  types: string[];
}

interface PlaceDetailsResponse {
  status: string;
  result?: {
    formatted_address?: string;
    geometry?: { location?: { lat: number; lng: number } };
    address_components?: AddressComponent[];
  };
}

interface AutocompleteResponse {
  status: string;
  predictions?: PlaceSuggestion[];
}

interface GeocodeResponse {
  status: string;
  results?: {
    formatted_address?: string;
    address_components?: AddressComponent[];
  }[];
}

async function proxyFetch<T>(params: Record<string, string>): Promise<T> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) {
    // Anonymous web visitors fall back to no-op; callers degrade gracefully.
    return { status: 'NO_SESSION' } as T;
  }
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${PROXY_BASE}?${qs}`, {
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: SUPABASE_ANON_KEY,
    },
  });
  return res.json() as Promise<T>;
}

async function directFetch<T>(url: string): Promise<T> {
  const res = await fetch(url);
  return res.json() as Promise<T>;
}

const findCityComponent = (components: AddressComponent[]): AddressComponent | undefined =>
  components.find((c) => c.types.includes('locality')) ||
  components.find((c) => c.types.includes('postal_town')) ||
  components.find((c) => c.types.includes('administrative_area_level_2'));

export async function fetchPlaceSuggestions(input: string): Promise<PlaceSuggestion[]> {
  if (input.trim().length < 3) return [];
  try {
    let data: AutocompleteResponse;
    if (Platform.OS === 'web') {
      data = await proxyFetch<AutocompleteResponse>({ endpoint: 'autocomplete', input });
    } else {
      const url =
        `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
        `?input=${encodeURIComponent(input)}&language=fr&key=${GOOGLE_MAPS_KEY}`;
      data = await directFetch<AutocompleteResponse>(url);
    }
    if (data.status === 'OK' && Array.isArray(data.predictions)) {
      return data.predictions;
    }
    return [];
  } catch {
    return [];
  }
}

export async function fetchPlaceDetails(placeId: string): Promise<PlaceDetails | null> {
  try {
    let data: PlaceDetailsResponse;
    if (Platform.OS === 'web') {
      data = await proxyFetch<PlaceDetailsResponse>({ endpoint: 'details', place_id: placeId });
    } else {
      const url =
        `https://maps.googleapis.com/maps/api/place/details/json` +
        `?place_id=${placeId}&fields=formatted_address,geometry,address_components&language=fr&key=${GOOGLE_MAPS_KEY}`;
      data = await directFetch<PlaceDetailsResponse>(url);
    }
    if (data.status === 'OK' && data.result) {
      const r = data.result;
      const lat = r.geometry?.location?.lat ?? 0;
      const lng = r.geometry?.location?.lng ?? 0;
      const cityComp = findCityComponent(r.address_components ?? []);
      return {
        address: r.formatted_address ?? '',
        lat,
        lng,
        city: cityComp?.long_name ?? null,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function reverseGeocode(lat: number, lng: number): Promise<PlaceDetails | null> {
  try {
    let data: GeocodeResponse;
    if (Platform.OS === 'web') {
      data = await proxyFetch<GeocodeResponse>({ endpoint: 'geocode', latlng: `${lat},${lng}` });
    } else {
      const url =
        `https://maps.googleapis.com/maps/api/geocode/json` +
        `?latlng=${lat},${lng}&language=fr&key=${GOOGLE_MAPS_KEY}`;
      data = await directFetch<GeocodeResponse>(url);
    }
    if (data.status === 'OK' && data.results && data.results.length > 0) {
      const r = data.results[0];
      const cityComp = findCityComponent(r.address_components ?? []);
      return {
        address: r.formatted_address ?? `${lat.toFixed(5)}, ${lng.toFixed(5)}`,
        lat,
        lng,
        city: cityComp?.long_name ?? null,
      };
    }
    return null;
  } catch {
    return null;
  }
}

export async function getCityFromCoords(lat: number, lng: number): Promise<string | null> {
  const result = await reverseGeocode(lat, lng);
  return result?.city ?? null;
}

export function getGoogleMapsEmbedUrl(lat: number, lng: number, zoom = 14): string {
  return (
    `https://www.google.com/maps/embed/v1/view` +
    `?key=${GOOGLE_MAPS_KEY}` +
    `&center=${lat},${lng}` +
    `&zoom=${zoom}` +
    `&maptype=roadmap`
  );
}

export function getStaticMapUrl(lat: number, lng: number, zoom = 13, size = '600x270'): string {
  if (Platform.OS === 'web') {
    const qs = new URLSearchParams({
      endpoint: 'staticmap',
      lat: String(lat),
      lng: String(lng),
      zoom: String(zoom),
      size,
    }).toString();
    return `${PROXY_BASE}?${qs}`;
  }
  return (
    `https://maps.googleapis.com/maps/api/staticmap` +
    `?center=${lat},${lng}` +
    `&zoom=${zoom}` +
    `&size=${size}` +
    `&scale=2` +
    `&maptype=roadmap` +
    `&style=feature:poi|visibility:off` +
    `&style=feature:transit|visibility:off` +
    `&key=${GOOGLE_MAPS_KEY}`
  );
}
