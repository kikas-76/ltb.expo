import { supabase } from './supabase';

// Returns a Supabase signed URL for a private bucket object, with a small
// in-memory cache so a list of N items doesn't trigger N requests on every
// re-render. URLs are issued with a 1h TTL; we refresh slightly before
// expiry. Failures are cached as null briefly to avoid hammering on a
// missing object.

const TTL_SECONDS = 3600;
const REFRESH_BEFORE_MS = 60_000;
const NEGATIVE_CACHE_MS = 30_000;

type Entry = { url: string | null; expiresAt: number };
const cache = new Map<string, Entry>();

export function privateUriFor(bucket: string, path: string): string {
  return `private://${bucket}/${path}`;
}

// Parse a `private://<bucket>/<path>` URI back into its parts. Returns
// null for any other shape (legacy https URLs, plain content strings).
export function parsePrivateUri(value: string): { bucket: string; path: string } | null {
  if (!value || !value.startsWith('private://')) return null;
  const rest = value.slice('private://'.length);
  const slash = rest.indexOf('/');
  if (slash < 0) return null;
  return { bucket: rest.slice(0, slash), path: rest.slice(slash + 1) };
}

export async function getSignedUrl(bucket: string, path: string): Promise<string | null> {
  const key = `${bucket}/${path}`;
  const now = Date.now();
  const cached = cache.get(key);
  if (cached && cached.expiresAt > now + REFRESH_BEFORE_MS) {
    return cached.url;
  }

  const { data, error } = await supabase.storage
    .from(bucket)
    .createSignedUrl(path, TTL_SECONDS);

  if (error || !data?.signedUrl) {
    cache.set(key, { url: null, expiresAt: now + NEGATIVE_CACHE_MS });
    return null;
  }

  cache.set(key, { url: data.signedUrl, expiresAt: now + TTL_SECONDS * 1000 });
  return data.signedUrl;
}

// Convenience for components that just received a stored value (could
// be a private:// URI from a recent upload, or a legacy https public
// URL from before the bucket migration). Returns whatever the caller
// can render without further logic.
export async function resolveAttachmentUrl(value: string | null | undefined): Promise<string | null> {
  if (!value) return null;
  const parsed = parsePrivateUri(value);
  if (!parsed) return value; // legacy public URL or plain content
  return getSignedUrl(parsed.bucket, parsed.path);
}
