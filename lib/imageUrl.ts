// Returns a smaller, faster Supabase Storage URL by injecting transform params
// into the render endpoint. Falls back to the input URL when it's not a
// Supabase storage URL or when transform isn't applicable.
//
// Docs: https://supabase.com/docs/guides/storage/serving/image-transformations

interface TransformOpts {
  width?: number;
  height?: number;
  quality?: number; // 20–100, default 75
  resize?: 'cover' | 'contain' | 'fill';
}

export function getOptimizedImageUrl(
  url: string | null | undefined,
  opts: TransformOpts = {},
): string | null {
  if (!url) return null;

  const isSupabaseStorage = url.includes('/storage/v1/object/public/');
  if (!isSupabaseStorage) return url;

  const renderUrl = url.replace('/storage/v1/object/public/', '/storage/v1/render/image/public/');
  const params = new URLSearchParams();
  if (opts.width) params.set('width', String(Math.round(opts.width)));
  if (opts.height) params.set('height', String(Math.round(opts.height)));
  params.set('quality', String(opts.quality ?? 75));
  if (opts.resize) params.set('resize', opts.resize);

  return `${renderUrl}?${params.toString()}`;
}
