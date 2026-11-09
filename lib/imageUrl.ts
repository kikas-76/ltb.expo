// Returns a smaller, faster Supabase Storage URL by injecting transform params
// into the render endpoint. Falls back to the input URL when it's not a
// Supabase storage URL or when transform isn't applicable.
//
// Docs: https://supabase.com/docs/guides/storage/serving/image-transformations
//
// PIÈGE (vérifié le 2026-09-04) : si on ne donne QUE `width`, le serveur garde
// la HAUTEUR D'ORIGINE (ex. 780 × 4032 pour une photo 4032 de haut) et, en
// mode cover par défaut, renvoie une bande verticale découpée au centre de la
// photo. D'où des « photos zoomées ». On envoie donc toujours width ET height ;
// sans hauteur explicite, on demande un ajustement (contain) dans un carré,
// ce qui conserve le ratio de la photo.

interface TransformOpts {
  width?: number;
  height?: number;
  quality?: number; // 20–100, default 75
  resize?: 'cover' | 'contain' | 'fill';
}

// Miniatures de conversation (64 points au plus, écrans 3x). Même URL partout :
// la vignette déjà chargée dans Messages ressert dans l'en-tête du chat.
export const CONVERSATION_THUMB_TRANSFORM: TransformOpts = {
  width: 200,
  height: 200,
  resize: 'cover',
  quality: 70,
};

export function getOptimizedImageUrl(
  url: string | null | undefined,
  opts: TransformOpts = {},
): string | null {
  if (!url) return null;

  const isSupabaseStorage = url.includes('/storage/v1/object/public/');
  if (!isSupabaseStorage) return url;

  const renderUrl = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
  const params = new URLSearchParams();

  const width = opts.width ? Math.round(opts.width) : undefined;
  const height = opts.height ? Math.round(opts.height) : width;
  const resize = opts.resize ?? (opts.height ? 'cover' : 'contain');

  if (width) params.set('width', String(width));
  if (height) params.set('height', String(height));
  params.set('quality', String(opts.quality ?? 75));
  if (width || height) params.set('resize', resize);

  return `${renderUrl}?${params.toString()}`;
}
