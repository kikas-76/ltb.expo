import { Platform } from 'react-native';

export interface UploadBody {
  body: Blob | ArrayBuffer;
  size: number;
  /** Type MIME détecté, ou null si inconnu. */
  type: string | null;
}

/**
 * Lit un fichier local (file://, blob:, content://…) pour l'envoyer à
 * Supabase Storage.
 *
 * Sur iOS/Android, un Blob React Native passé à storage.upload() est emballé
 * dans un FormData que React Native ne sait pas sérialiser : le fichier
 * arrive vide côté serveur (photo de profil, photos de chat et d'annonce
 * invisibles). Un ArrayBuffer est envoyé tel quel et fonctionne. Sur web, le
 * Blob reste le format naturel (et conserve type/size).
 */
export async function readUploadBody(uri: string): Promise<UploadBody> {
  const response = await fetch(uri);

  if (Platform.OS === 'web') {
    const blob = await response.blob();
    return { body: blob, size: blob.size, type: blob.type || null };
  }

  const buffer = await response.arrayBuffer();
  const header = response.headers?.get?.('content-type')?.split(';')[0]?.trim() ?? null;
  const type = header && header !== 'application/octet-stream' ? header : null;
  return { body: buffer, size: buffer.byteLength, type };
}
