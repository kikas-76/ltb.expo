// Native (iOS / Android) stub for HEIC conversion. The web variant lives
// in heicConvert.web.ts and is selected by Expo's bundler on the web
// target. On native, expo-image-picker already returns JPEG/PNG (or a
// platform asset URI), so HEIC conversion isn't needed.

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

// Native callers don't have a `File` instance — image-picker hands back
// a URI. The signature is kept compatible for the web call site; on
// native this function is never actually invoked.
export async function convertHeicToJpegIfPossible<T>(file: T): Promise<T> {
  return file;
}
