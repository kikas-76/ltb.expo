import { describe, expect, it } from 'vitest';
import { inferMimeFromName, convertHeicToJpegIfPossible } from '@/lib/heicConvert';

describe('inferMimeFromName', () => {
  it('maps common image extensions', () => {
    expect(inferMimeFromName('photo.jpg')).toBe('image/jpeg');
    expect(inferMimeFromName('photo.JPEG')).toBe('image/jpeg');
    expect(inferMimeFromName('photo.PNG')).toBe('image/png');
    expect(inferMimeFromName('photo.webp')).toBe('image/webp');
    expect(inferMimeFromName('photo.heic')).toBe('image/heic');
    expect(inferMimeFromName('photo.HEIF')).toBe('image/heif');
  });

  it('falls back to jpeg on unknown / missing extension', () => {
    expect(inferMimeFromName('photo')).toBe('image/jpeg');
    expect(inferMimeFromName('photo.gif')).toBe('image/jpeg');
    expect(inferMimeFromName(null)).toBe('image/jpeg');
    expect(inferMimeFromName(undefined)).toBe('image/jpeg');
    expect(inferMimeFromName('')).toBe('image/jpeg');
  });

  it('handles paths with multiple dots', () => {
    expect(inferMimeFromName('vacation.summer.2024.png')).toBe('image/png');
  });
});

// Note: convertHeicToJpegIfPossible is exercised here against the native
// stub (vitest does not pick the .web.ts variant). The stub is the
// identity, so the result is always the input. The real conversion path
// runs in the browser at runtime and is out of scope for unit tests.
describe('convertHeicToJpegIfPossible (native stub)', () => {
  it('returns the input unchanged', async () => {
    const fake = { name: 'photo.heic', type: 'image/heic' } as any;
    expect(await convertHeicToJpegIfPossible(fake)).toBe(fake);
  });

  it('returns the input even for non-heic files', async () => {
    const fake = { name: 'photo.jpg', type: 'image/jpeg' } as any;
    expect(await convertHeicToJpegIfPossible(fake)).toBe(fake);
  });
});
