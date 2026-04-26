// Web-only HEIC → JPEG conversion using FileReader + canvas. Imported via
// `@/lib/heicConvert` — Expo resolver picks this `.web.ts` variant on web
// and the no-op companion on native. Keeps DOM globals (FileReader,
// document, HTMLImageElement, canvas, File, Blob) out of native bundles.

export function inferMimeFromName(name: string | undefined | null): string {
  const ext = (name ?? '').toLowerCase().split('.').pop() ?? '';
  switch (ext) {
    case 'jpg':
    case 'jpeg': return 'image/jpeg';
    case 'png': return 'image/png';
    case 'webp': return 'image/webp';
    case 'heic': return 'image/heic';
    case 'heif': return 'image/heif';
    default: return 'image/jpeg';
  }
}

// Best-effort HEIC → JPEG conversion using a canvas. Works on Safari
// (native HEIC support). On other browsers the Image load fails and we
// upload the HEIC as-is; Supabase accepts any blob, and the target
// viewer may still render it.
export async function convertHeicToJpegIfPossible(file: File): Promise<File> {
  const type = (file.type || inferMimeFromName(file.name)).toLowerCase();
  if (type !== 'image/heic' && type !== 'image/heif') return file;
  try {
    const dataUrl: string = await new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new (globalThis as any).Image() as HTMLImageElement;
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('heic decode failed'));
      el.src = dataUrl;
    });
    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return file;
    ctx.drawImage(img, 0, 0);
    const blob: Blob | null = await new Promise((resolve) =>
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.9),
    );
    if (!blob) return file;
    const newName = file.name.replace(/\.hei[cf]$/i, '.jpg');
    return new File([blob], newName, { type: 'image/jpeg' });
  } catch {
    return file;
  }
}
