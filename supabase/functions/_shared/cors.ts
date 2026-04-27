// Shared CORS helper for edge functions.
//
// Why a whitelist instead of `*`:
// Wildcard `Access-Control-Allow-Origin: *` lets any third-party site
// read the response body. We rely on JWT auth, but any future bug that
// leaks a token (e.g. another XSS site, a malicious extension) becomes
// instantly weaponisable. Restricting CORS to known origins is cheap
// defense in depth.
//
// Native iOS/Android apps don't trigger CORS — the browser is the only
// caller that needs to be allow-listed. Server-to-server calls (Stripe
// webhook, cron) don't carry an Origin header so this whitelist is a
// no-op for them.

const ALLOWED_ORIGINS = new Set<string>([
  // Production web
  "https://app.louetonbien.fr",
  "https://louetonbien.fr",
  "https://www.louetonbien.fr",
  // Vercel preview deploys (any *.vercel.app under the louetonbien project)
  // are allowlisted via the regex check below, not this set.
  // Local dev (Expo / browser)
  "http://localhost:8081",
  "http://localhost:19006",
  "http://localhost:3000",
  "http://127.0.0.1:8081",
  "http://127.0.0.1:19006",
  "http://127.0.0.1:3000",
]);

const VERCEL_PREVIEW_RE = /^https:\/\/[a-z0-9-]+-louetonbien(?:-[a-z0-9-]+)?\.vercel\.app$/i;

const BASE_HEADERS = {
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey, x-internal-secret",
  "Access-Control-Max-Age": "86400",
  Vary: "Origin",
};

export interface CorsOptions {
  /** Override the allowed methods for this function (e.g. webhooks: "POST, OPTIONS"). */
  methods?: string;
  /** Override the allowed headers (e.g. Stripe webhook needs Stripe-Signature). */
  headers?: string;
}

/**
 * Builds CORS response headers based on the incoming request's Origin.
 * If the origin is not in the allowlist (or absent), no
 * Access-Control-Allow-Origin is returned — the browser will reject the
 * cross-origin response, which is the desired behaviour. Non-browser
 * callers (cron, Stripe webhooks) don't send Origin and are unaffected.
 */
export function buildCorsHeaders(req: Request, opts: CorsOptions = {}): Record<string, string> {
  const headers: Record<string, string> = {
    ...BASE_HEADERS,
  };
  if (opts.methods) headers["Access-Control-Allow-Methods"] = opts.methods;
  if (opts.headers) headers["Access-Control-Allow-Headers"] = opts.headers;

  const origin = req.headers.get("Origin");
  if (origin && (ALLOWED_ORIGINS.has(origin) || VERCEL_PREVIEW_RE.test(origin))) {
    headers["Access-Control-Allow-Origin"] = origin;
  }
  return headers;
}

/** OPTIONS preflight response, with the same CORS headers used by the function. */
export function preflightResponse(req: Request, opts: CorsOptions = {}): Response {
  return new Response(null, { status: 204, headers: buildCorsHeaders(req, opts) });
}
