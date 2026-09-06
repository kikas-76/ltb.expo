import { Platform } from 'react-native';

export interface GeoPosition {
  latitude: number;
  longitude: number;
}

export type GeoErrorCode = 'unavailable' | 'denied' | 'failed';

export class GeoError extends Error {
  code: GeoErrorCode;
  constructor(code: GeoErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export const GEO_ERROR_MESSAGES: Record<GeoErrorCode, string> = {
  unavailable: "La géolocalisation n'est pas disponible sur cet appareil.",
  denied: "Accès à la position refusé. Autorisez-le dans les Réglages de votre appareil.",
  failed: "Impossible d'obtenir votre position. Vérifiez les permissions.",
};

export function geoErrorMessage(e: unknown): string {
  return e instanceof GeoError ? GEO_ERROR_MESSAGES[e.code] : GEO_ERROR_MESSAGES.failed;
}

/**
 * Position courante, multiplateforme.
 * - web : navigator.geolocation (API du navigateur)
 * - iOS/Android : expo-location (navigator.geolocation n'existe pas dans
 *   React Native, d'où le message « non disponible » avant ce correctif).
 */
export async function getCurrentPosition(opts: { timeoutMs?: number } = {}): Promise<GeoPosition> {
  const timeoutMs = opts.timeoutMs ?? 10000;

  if (Platform.OS === 'web') {
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      throw new GeoError('unavailable', GEO_ERROR_MESSAGES.unavailable);
    }
    return new Promise<GeoPosition>((resolve, reject) => {
      navigator.geolocation.getCurrentPosition(
        (pos) => resolve({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
        (err) => reject(new GeoError(err.code === 1 ? 'denied' : 'failed', err.message)),
        { timeout: timeoutMs, enableHighAccuracy: false },
      );
    });
  }

  // require dynamique : garde expo-location hors du bundle web.
  const Location = require('expo-location');

  const { status } = await Location.requestForegroundPermissionsAsync();
  if (status !== 'granted') {
    throw new GeoError('denied', GEO_ERROR_MESSAGES.denied);
  }

  const timeout = new Promise<never>((_, reject) =>
    setTimeout(() => reject(new GeoError('failed', 'timeout')), timeoutMs),
  );

  try {
    const pos = await Promise.race([
      Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Balanced }),
      timeout,
    ]);
    return { latitude: pos.coords.latitude, longitude: pos.coords.longitude };
  } catch (e) {
    // Dernier recours : la dernière position connue par le système.
    const last = await Location.getLastKnownPositionAsync().catch(() => null);
    if (last) return { latitude: last.coords.latitude, longitude: last.coords.longitude };
    if (e instanceof GeoError) throw e;
    throw new GeoError('failed', GEO_ERROR_MESSAGES.failed);
  }
}
