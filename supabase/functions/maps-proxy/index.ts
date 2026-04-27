import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, preflightResponse, type CorsOptions } from "../_shared/cors.ts";

const corsOpts: CorsOptions = { methods: "GET, POST, OPTIONS" };

// 60 requests per minute per authenticated user, all maps-proxy endpoints
// combined. Google Maps API quotas are billed per request, so even a
// generous cap protects against quota burn from a misbehaving client.
const RATE_LIMIT_PER_MINUTE = 60;
const RATE_LIMIT_WINDOW_SECONDS = 60;

const ALLOWED_ENDPOINTS = new Set([
  "autocomplete",
  "details",
  "geocode",
  "staticmap",
]);

function jsonError(corsHeaders: Record<string, string>, message: string, status = 400) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// Strict number-in-range validator. Returns null on any invalid input.
function clampedNumber(raw: string | null, min: number, max: number, fallback?: number) {
  if (raw === null || raw === "") return fallback ?? null;
  const n = Number(raw);
  if (!Number.isFinite(n)) return null;
  if (n < min || n > max) return null;
  return n;
}

function validateLatLng(latlng: string): { lat: number; lng: number } | null {
  const parts = latlng.split(",");
  if (parts.length !== 2) return null;
  const lat = Number(parts[0]);
  const lng = Number(parts[1]);
  if (!Number.isFinite(lat) || !Number.isFinite(lng)) return null;
  if (lat < -90 || lat > 90) return null;
  if (lng < -180 || lng > 180) return null;
  return { lat, lng };
}

function validateSize(size: string): { width: number; height: number } | null {
  const m = /^(\d{1,4})x(\d{1,4})$/.exec(size);
  if (!m) return null;
  const width = Number(m[1]);
  const height = Number(m[2]);
  if (width < 50 || width > 800) return null;
  if (height < 50 || height > 800) return null;
  return { width, height };
}

// Place IDs from Google are alphanumeric with -_ separators, typically <100 chars.
function isSafePlaceId(id: string): boolean {
  return /^[A-Za-z0-9_-]{1,256}$/.test(id);
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req, corsOpts);
  }
  const corsHeaders = buildCorsHeaders(req, corsOpts);

  try {
    // ---- Auth: require an authenticated Supabase session ----
    const authHeader = req.headers.get("Authorization") ?? "";
    const token = authHeader.startsWith("Bearer ") ? authHeader.slice(7).trim() : "";
    if (!token) return jsonError(corsHeaders, "Authentication required", 401);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { data: { user }, error: authErr } = await supabase.auth.getUser(token);
    if (authErr || !user) return jsonError(corsHeaders, "Unauthorized", 401);

    // ---- Server-side Maps key only (no client-supplied bypass) ----
    const mapsKey = Deno.env.get("GOOGLE_MAPS_KEY") ?? "";
    if (!mapsKey) return jsonError(corsHeaders, "Maps API key not configured", 500);

    // ---- Endpoint whitelist ----
    const url = new URL(req.url);
    const endpoint = url.searchParams.get("endpoint") ?? "";
    if (!ALLOWED_ENDPOINTS.has(endpoint)) {
      return jsonError(corsHeaders, "Unknown endpoint", 400);
    }

    // ---- Rate limit (per user, all endpoints combined) ----
    const { data: allowed, error: rlErr } = await supabase.rpc("check_rate_limit", {
      p_key: `maps:${user.id}`,
      p_max_per_window: RATE_LIMIT_PER_MINUTE,
      p_window_seconds: RATE_LIMIT_WINDOW_SECONDS,
    });
    if (rlErr) return jsonError(corsHeaders, "Rate-limit check failed", 500);
    if (!allowed) return jsonError(corsHeaders, "Rate limit exceeded", 429);

    // ---- Endpoint-specific input validation + URL build ----
    let googleUrl: string;

    if (endpoint === "autocomplete") {
      const input = (url.searchParams.get("input") ?? "").trim();
      if (!input || input.length > 200) return jsonError(corsHeaders, "Invalid input", 400);
      googleUrl =
        `https://maps.googleapis.com/maps/api/place/autocomplete/json` +
        `?input=${encodeURIComponent(input)}` +
        `&language=fr` +
        `&key=${mapsKey}`;
    } else if (endpoint === "details") {
      const placeId = url.searchParams.get("place_id") ?? "";
      if (!isSafePlaceId(placeId)) return jsonError(corsHeaders, "Invalid place_id", 400);
      googleUrl =
        `https://maps.googleapis.com/maps/api/place/details/json` +
        `?place_id=${encodeURIComponent(placeId)}` +
        `&fields=formatted_address,geometry,address_components` +
        `&language=fr` +
        `&key=${mapsKey}`;
    } else if (endpoint === "geocode") {
      const latlngRaw = url.searchParams.get("latlng") ?? "";
      const latlng = validateLatLng(latlngRaw);
      if (!latlng) return jsonError(corsHeaders, "Invalid latlng", 400);
      googleUrl =
        `https://maps.googleapis.com/maps/api/geocode/json` +
        `?latlng=${latlng.lat},${latlng.lng}` +
        `&language=fr` +
        `&key=${mapsKey}`;
    } else {
      // staticmap
      const lat = clampedNumber(url.searchParams.get("lat"), -90, 90);
      const lng = clampedNumber(url.searchParams.get("lng"), -180, 180);
      if (lat === null || lng === null) return jsonError(corsHeaders, "Invalid lat/lng", 400);

      const zoom = clampedNumber(url.searchParams.get("zoom"), 1, 21, 13);
      if (zoom === null) return jsonError(corsHeaders, "Invalid zoom (1-21)", 400);

      const sizeRaw = url.searchParams.get("size") ?? "600x270";
      const size = validateSize(sizeRaw);
      if (!size) return jsonError(corsHeaders, "Invalid size (50-800 each side)", 400);

      googleUrl =
        `https://maps.googleapis.com/maps/api/staticmap` +
        `?center=${lat},${lng}` +
        `&zoom=${zoom}` +
        `&size=${size.width}x${size.height}` +
        `&scale=2` +
        `&maptype=roadmap` +
        `&style=feature:poi|visibility:off` +
        `&style=feature:transit|visibility:off` +
        `&key=${mapsKey}`;

      const imgRes = await fetch(googleUrl);
      if (!imgRes.ok) {
        return jsonError(corsHeaders, `Google Maps error: ${imgRes.status}`, imgRes.status);
      }
      const contentType = imgRes.headers.get("Content-Type") ?? "image/png";
      const imgBuffer = await imgRes.arrayBuffer();
      return new Response(imgBuffer, {
        headers: {
          ...corsHeaders,
          "Content-Type": contentType,
          "Cache-Control": "public, max-age=86400",
        },
      });
    }

    const googleRes = await fetch(googleUrl);
    const data = await googleRes.json();

    return new Response(JSON.stringify(data), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (_err) {
    return jsonError(corsHeaders, "Internal error", 500);
  }
});
