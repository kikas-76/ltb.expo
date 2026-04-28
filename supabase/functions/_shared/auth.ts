// Shared auth helpers for edge functions.
//
// Two patterns this file standardises:
//
// 1. `getAccessToken(req, body)` — extract a Supabase user JWT, preferring
//    the `Authorization: Bearer <token>` header over a body-supplied
//    `access_token`. Header-first matches platform conventions and keeps
//    the token out of request-body logging; body fallback exists for
//    legacy clients that posted the token in the body (Google OAuth-style
//    pattern flagged by the 2026-04-28 audit).
//
// 2. `constantTimeEquals(a, b)` — timing-safe string comparison for
//    INTERNAL_EDGE_SECRET / cron secret checks. The native string `===`
//    short-circuits on the first mismatch, which leaks a (tiny) timing
//    signal. crypto.subtle.timingSafeEqual works on equal-length byte
//    arrays, so we pad shorter inputs to the longer length and compare.

export function getAccessToken(req: Request, body: Record<string, unknown> | null | undefined): string | null {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization") ?? "";
  if (authHeader.startsWith("Bearer ")) {
    const token = authHeader.slice(7).trim();
    if (token) return token;
  }
  const fromBody = typeof body?.access_token === "string" ? body.access_token.trim() : "";
  return fromBody || null;
}

export function constantTimeEquals(a: string | null | undefined, b: string | null | undefined): boolean {
  if (!a || !b) return false;
  const aBytes = new TextEncoder().encode(a);
  const bBytes = new TextEncoder().encode(b);
  // Pad to the longer length so we compare equal-sized buffers and don't
  // early-return on length mismatch (which is itself a timing oracle).
  const len = Math.max(aBytes.length, bBytes.length);
  const aPadded = new Uint8Array(len);
  const bPadded = new Uint8Array(len);
  aPadded.set(aBytes);
  bPadded.set(bBytes);
  let diff = aBytes.length ^ bBytes.length;
  for (let i = 0; i < len; i++) {
    diff |= aPadded[i] ^ bPadded[i];
  }
  return diff === 0;
}

// Read a required env var; throw at module load if missing. Use this for
// cron / webhook secrets where a missing config should fail loudly rather
// than silently 401 every call.
export function requireEnv(name: string): string {
  const v = Deno.env.get(name);
  if (!v) {
    throw new Error(`Missing required env var: ${name}`);
  }
  return v;
}

// Convenience wrapper: did the caller present the cron/internal secret?
// Header `x-internal-secret` preferred; body `internal_secret` fallback.
// Both checked with constant-time comparison.
export function isInternalCall(
  req: Request,
  body: Record<string, unknown> | null | undefined,
  expected: string,
): boolean {
  if (!expected) return false;
  const headerSecret = req.headers.get("x-internal-secret")?.trim() ?? "";
  if (headerSecret && constantTimeEquals(headerSecret, expected)) return true;
  const bodySecret = typeof body?.internal_secret === "string" ? body.internal_secret.trim() : "";
  if (bodySecret && constantTimeEquals(bodySecret, expected)) return true;
  return false;
}
