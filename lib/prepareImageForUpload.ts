import { Image, Platform } from 'react-native';
import { inferMimeFromName } from '@/lib/heicConvert';

export interface PreparedImage {
  uri: string;
  mimeType: string;
}

async function reencodeWebImage(uri: string, maxSize: number, quality: number): Promise<PreparedImage | null> {
  if (typeof document === 'undefined' || typeof window === 'undefined') return null;
  const img = new (window as any).Image() as HTMLImageElement;
  img.crossOrigin = 'anonymous';
  await new Promise<void>((resolve, reject) => {
    img.onload = () => resolve();
    img.onerror = () => reject(new Error('decode failed'));
    img.src = uri;
  });
  const scale = Math.min(1, maxSize / Math.max(img.naturalWidth, img.naturalHeight));
  const canvas = document.createElement('canvas');
  canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
  canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
  const ctx = canvas.getContext('2d');
  if (!ctx) return null;
  ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', quality));
  if (!blob) return null;
  return { uri: URL.createObjectURL(blob), mimeType: 'image/jpeg' };
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
  if (Platform.OS === 'web') {
    // Ré-encodage via canvas : supprime les métadonnées EXIF (dont la position
    // GPS exacte) avant l'envoi dans un bucket public, et borne la taille.
    try {
      const reencoded = await reencodeWebImage(uri, opts.maxSize ?? 1600, opts.quality ?? 0.85);
      if (reencoded) return reencoded;
    } catch {}
    return { uri, mimeType: inferMimeFromName(uri) };
  }

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
