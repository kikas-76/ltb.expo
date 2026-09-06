import { Image, Platform } from 'react-native';
import { inferMimeFromName } from '@/lib/heicConvert';

export interface PreparedImage {
  uri: string;
  mimeType: string;
}

function localImageSize(uri: string): Promise<{ width: number; height: number } | null> {
  return new Promise((resolve) => {
    Image.getSize(uri, (width, height) => resolve({ width, height }), () => resolve(null));
  });
}

/**
 * Prépare une photo choisie sur iOS/Android avant envoi : ré-encodage en JPEG,
 * orientation EXIF appliquée, plus grand côté borné (1600 px par défaut).
 *
 * Pourquoi : la galerie iPhone fournit des HEIC de 4000 px (1,5 à 4 Mo),
 * illisibles sur Android et dans la plupart des navigateurs une fois dans le
 * bucket. Le JPEG borné pèse 4 à 5 fois moins et s'affiche partout.
 * Sur le web, la conversion HEIC est déjà faite côté navigateur (heicConvert.web).
 */
export async function prepareImageForUpload(
  uri: string,
  opts: { maxSize?: number; quality?: number } = {},
): Promise<PreparedImage> {
  if (Platform.OS === 'web') return { uri, mimeType: inferMimeFromName(uri) };

  const maxSize = opts.maxSize ?? 1600;
  try {
    const { manipulateAsync, SaveFormat } = require('expo-image-manipulator');
    const size = await localImageSize(uri);
    const actions: any[] = [];
    if (size && Math.max(size.width, size.height) > maxSize) {
      actions.push(
        size.width >= size.height ? { resize: { width: maxSize } } : { resize: { height: maxSize } },
      );
    }
    const result = await manipulateAsync(uri, actions, {
      compress: opts.quality ?? 0.82,
      format: SaveFormat.JPEG,
    });
    return { uri: result.uri, mimeType: 'image/jpeg' };
  } catch {
    // Dernier recours : le fichier tel quel.
    return { uri, mimeType: inferMimeFromName(uri) };
  }
}
