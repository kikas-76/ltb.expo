// Annonce préparée sans compte via le lien /publier (web).
//
// Actions (POST { action, ... }) :
//   create   (visiteur)  → enregistre le brouillon, renvoie le jeton secret et
//                          des URL d'envoi signées pour les photos (bucket privé)
//   ready    (visiteur)  → vérifie que toutes les photos sont arrivées
//   status   (visiteur)  → état du brouillon (aperçu, annonce publiée ou non)
//   publish  (connecté)  → crée l'annonce sur le compte de l'appelant, une seule
//                          fois même si deux onglets publient en même temps
//   cleanup  (cron)      → supprime les brouillons non publiés de plus de 7 jours
//
// Le jeton n'est jamais stocké en clair (sha256). Déployée sans vérification
// JWT : les visiteurs n'ont pas de session ; publish vérifie lui-même l'appelant.

import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient, type SupabaseClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, preflightResponse, type CorsOptions } from "../_shared/cors.ts";
import { getAccessToken, isInternalCall, requireEnv } from "../_shared/auth.ts";

const INTERNAL_SECRET = requireEnv("INTERNAL_EDGE_SECRET");
const corsOpts: CorsOptions = { methods: "POST, OPTIONS" };

const DRAFT_BUCKET = "listing-drafts";
const PHOTO_BUCKET = "listing-photos";
const MAX_PHOTOS = 10;
const CREATES_PER_HOUR_PER_IP = 10;
const DRAFT_TTL_DAYS = 7;
const PUBLISH_LOCK_MS = 2 * 60 * 1000;

const EXT_BY_TYPE: Record<string, string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
  "image/heic": "heic",
  "image/heif": "heif",
};
const TYPE_BY_EXT: Record<string, string> = Object.fromEntries(
  Object.entries(EXT_BY_TYPE).map(([t, e]) => [e, t]),
);

type DraftData = {
  name: string;
  description: string;
  category_id: string;
  subcategory_id: string | null;
  price: number;
  deposit: number;
  location: { address: string; city: string | null; postcode: string | null; lat: number; lng: number };
};

type DraftRow = {
  id: string;
  status: string;
  data: DraftData;
  photo_paths: string[];
  claimed_by: string | null;
  claimed_at: string | null;
  listing_id: string | null;
};

class HttpError extends Error {
  constructor(public status: number, public code: string, message?: string) {
    super(message ?? code);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflightResponse(req, corsOpts);
  const corsHeaders = buildCorsHeaders(req, corsOpts);
  const json = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  if (req.method !== "POST") return json(405, { error: "method_not_allowed" });

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json(400, { error: "invalid_json" });
  }

  const admin = createClient(
    Deno.env.get("SUPABASE_URL") ?? "",
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    { auth: { persistSession: false } },
  );

  try {
    switch (body.action) {
      case "create":
        return json(200, await createDraft(admin, req, body));
      case "ready":
        return json(200, await markReady(admin, body));
      case "status":
        return json(200, await draftStatus(admin, body));
      case "publish":
        return json(200, await publishDraft(admin, req, body));
      case "cleanup":
        if (!isInternalCall(req, body, INTERNAL_SECRET)) return json(401, { error: "unauthorized" });
        return json(200, await cleanup(admin));
      default:
        return json(400, { error: "unknown_action" });
    }
  } catch (e) {
    if (e instanceof HttpError) return json(e.status, { error: e.code, message: e.message });
    console.error("listing-draft", e);
    return json(500, { error: "server_error" });
  }
});

// ─── create ────────────────────────────────────────────────────────────────

async function createDraft(admin: SupabaseClient, req: Request, body: Record<string, unknown>) {
  const name = str(body.name).trim();
  const description = str(body.description).trim();
  if (name.length < 3 || name.length > 80) throw new HttpError(400, "invalid_name");
  if (description.length < 10 || description.length > 500) throw new HttpError(400, "invalid_description");

  const price = round2(num(body.price));
  const deposit = round2(num(body.deposit ?? 0));
  if (!(price > 0) || price > 100000) throw new HttpError(400, "invalid_price");
  if (!(deposit >= 0) || deposit > 100000) throw new HttpError(400, "invalid_deposit");

  const categoryId = str(body.category_id);
  const subcategoryId = body.subcategory_id ? str(body.subcategory_id) : null;
  const { data: category } = await admin.from("categories").select("id").eq("id", categoryId).maybeSingle();
  if (!category) throw new HttpError(400, "invalid_category");
  if (subcategoryId) {
    const { data: sub } = await admin
      .from("subcategories")
      .select("id")
      .eq("id", subcategoryId)
      .eq("category_id", categoryId)
      .maybeSingle();
    if (!sub) throw new HttpError(400, "invalid_subcategory");
  }

  const loc = (body.location ?? {}) as Record<string, unknown>;
  const location = {
    address: str(loc.address).trim().slice(0, 200),
    city: loc.city ? str(loc.city).trim().slice(0, 100) : null,
    postcode: loc.postcode ? str(loc.postcode).trim().slice(0, 10) : null,
    lat: num(loc.lat),
    lng: num(loc.lng),
  };
  if (
    location.address.length < 2 ||
    !Number.isFinite(location.lat) || Math.abs(location.lat) > 90 ||
    !Number.isFinite(location.lng) || Math.abs(location.lng) > 180
  ) {
    throw new HttpError(400, "invalid_location");
  }

  const photos = Array.isArray(body.photos) ? body.photos : [];
  if (photos.length < 1 || photos.length > MAX_PHOTOS) throw new HttpError(400, "invalid_photos");
  const exts = photos.map((p) => EXT_BY_TYPE[str((p as Record<string, unknown>)?.type)]);
  if (exts.some((e) => !e)) throw new HttpError(400, "invalid_photo_type");

  const { data: blocked } = await admin.rpc("contains_blocked_term", { p_text: `${name} ${description}` });
  if (blocked === true) {
    throw new HttpError(
      422,
      "blocked_terms",
      "Ce contenu contient des termes interdits par nos conditions d'utilisation.",
    );
  }

  const ipHash = await sha256Hex(`${INTERNAL_SECRET}:${clientIp(req)}`);
  const { data: allowed, error: rlErr } = await admin.rpc("check_rate_limit", {
    p_key: `listing-draft:${ipHash.slice(0, 32)}`,
    p_max_per_window: CREATES_PER_HOUR_PER_IP,
    p_window_seconds: 3600,
  });
  if (rlErr) throw rlErr;
  if (!allowed) throw new HttpError(429, "rate_limited");

  const source = str(body.source).toLowerCase().replace(/[^a-z0-9_-]/g, "").slice(0, 40) || null;
  const id = crypto.randomUUID();
  const token = randomToken();
  const photoPaths = exts.map((ext, i) => `${id}/${i}.${ext}`);
  const data: DraftData = {
    name,
    description,
    category_id: categoryId,
    subcategory_id: subcategoryId,
    price,
    deposit,
    location,
  };

  const { error: insErr } = await admin.from("listing_drafts").insert({
    id,
    token_hash: await sha256Hex(token),
    data,
    photo_paths: photoPaths,
    source,
    ip_hash: ipHash.slice(0, 32),
  });
  if (insErr) throw insErr;

  const uploads = [];
  for (const path of photoPaths) {
    const { data: signed, error } = await admin.storage.from(DRAFT_BUCKET).createSignedUploadUrl(path);
    if (error || !signed) throw error ?? new Error("signed_upload_failed");
    uploads.push({ path, token: signed.token });
  }

  return { token, uploads };
}

// ─── ready ─────────────────────────────────────────────────────────────────

async function markReady(admin: SupabaseClient, body: Record<string, unknown>) {
  const draft = await draftByToken(admin, body.token);
  if (draft.status !== "pending_photos") return { status: draft.status };

  const { data: files, error } = await admin.storage.from(DRAFT_BUCKET).list(draft.id, { limit: 100 });
  if (error) throw error;
  const present = new Set((files ?? []).map((f) => `${draft.id}/${f.name}`));
  const missing = draft.photo_paths.filter((p) => !present.has(p));
  if (missing.length > 0) throw new HttpError(409, "photos_missing");

  const { error: upErr } = await admin
    .from("listing_drafts")
    .update({ status: "ready", ready_at: new Date().toISOString() })
    .eq("id", draft.id)
    .eq("status", "pending_photos");
  if (upErr) throw upErr;
  return { status: "ready" };
}

// ─── status ────────────────────────────────────────────────────────────────

async function draftStatus(admin: SupabaseClient, body: Record<string, unknown>) {
  const draft = await draftByToken(admin, body.token);
  let photoUrl: string | null = null;
  if (draft.status !== "published" && draft.photo_paths[0]) {
    const { data } = await admin.storage.from(DRAFT_BUCKET).createSignedUrl(draft.photo_paths[0], 3600);
    photoUrl = data?.signedUrl ?? null;
  }
  return {
    status: draft.status,
    listing_id: draft.listing_id,
    name: draft.data.name,
    price: draft.data.price,
    city: draft.data.location.city,
    address: draft.data.location.address,
    photo_url: photoUrl,
  };
}

// ─── publish ───────────────────────────────────────────────────────────────

async function publishDraft(admin: SupabaseClient, req: Request, body: Record<string, unknown>) {
  const jwt = getAccessToken(req, null);
  const { data: auth } = jwt ? await admin.auth.getUser(jwt) : { data: { user: null } };
  const user = auth?.user;
  if (!user) throw new HttpError(401, "unauthorized");

  const draft = await draftByToken(admin, body.token);
  if (draft.status === "published") {
    if (draft.claimed_by === user.id && draft.listing_id) return { status: "published", listing_id: draft.listing_id };
    throw new HttpError(409, "already_published");
  }
  if (draft.status === "pending_photos") throw new HttpError(409, "photos_missing");

  const { data: profile, error: pErr } = await admin
    .from("profiles")
    .select("id, username, onboarding_completed, account_status, banned_until, is_pro, location_data")
    .eq("id", user.id)
    .maybeSingle();
  if (pErr) throw pErr;
  if (!profile?.onboarding_completed || !profile.username) throw new HttpError(409, "profile_incomplete");
  const suspended =
    profile.account_status === "suspended" &&
    !(profile.banned_until && new Date(profile.banned_until).getTime() < Date.now());
  if (profile.account_status === "banned" || profile.account_status === "deleted" || suspended) {
    throw new HttpError(403, "account_inactive", "Votre compte est suspendu. Contactez admin@louetonbien.fr.");
  }

  // Verrou : un seul appel publie (deux onglets peuvent finir l'inscription
  // en même temps). Un verrou de plus de 2 minutes est considéré abandonné.
  const now = new Date().toISOString();
  const staleBefore = new Date(Date.now() - PUBLISH_LOCK_MS).toISOString();
  const { data: locked, error: lockErr } = await admin
    .from("listing_drafts")
    .update({ status: "publishing", claimed_by: user.id, claimed_at: now, error: null })
    .eq("id", draft.id)
    .or(`status.in.(ready,failed),and(status.eq.publishing,claimed_at.lt."${staleBefore}")`)
    .select("id")
    .maybeSingle();
  if (lockErr) throw lockErr;
  if (!locked) return { status: "publishing" };

  const copied: string[] = [];
  try {
    const photoUrls: string[] = [];
    for (const path of draft.photo_paths) {
      const { data: blob, error: dlErr } = await admin.storage.from(DRAFT_BUCKET).download(path);
      if (dlErr || !blob) throw dlErr ?? new Error("photo_download_failed");
      const ext = path.split(".").pop() ?? "jpg";
      const dest = `${user.id}/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.${ext}`;
      const { error: upErr } = await admin.storage
        .from(PHOTO_BUCKET)
        .upload(dest, blob, { contentType: TYPE_BY_EXT[ext] ?? "image/jpeg", cacheControl: "31536000" });
      if (upErr) throw upErr;
      copied.push(dest);
      photoUrls.push(admin.storage.from(PHOTO_BUCKET).getPublicUrl(dest).data.publicUrl);
    }

    const d = draft.data;
    const { data: category } = await admin.from("categories").select("name").eq("id", d.category_id).maybeSingle();
    const { data: subcategory } = d.subcategory_id
      ? await admin.from("subcategories").select("name").eq("id", d.subcategory_id).maybeSingle()
      : { data: null };

    const { data: listing, error: insErr } = await admin
      .from("listings")
      .insert({
        owner_id: user.id,
        name: d.name,
        description: d.description,
        category_id: d.category_id,
        category_name: category?.name ?? null,
        subcategory_id: d.subcategory_id,
        subcategory_name: subcategory?.name ?? null,
        price: d.price,
        deposit_amount: d.deposit,
        photos_url: photoUrls,
        is_active: true,
        latitude: d.location.lat,
        longitude: d.location.lng,
        owner_type: profile.is_pro ? "professionnel" : "particulier",
        stock_count: 1,
        packs: null,
      })
      .select("id")
      .single();
    if (insErr) {
      if (insErr.code === "P0001") throw new HttpError(422, "rejected", insErr.message);
      throw insErr;
    }

    const { error: doneErr } = await admin
      .from("listing_drafts")
      .update({ status: "published", listing_id: listing.id, published_at: new Date().toISOString() })
      .eq("id", draft.id);
    if (doneErr) console.error("listing-draft: draft not marked published", draft.id, doneErr);

    // Compte neuf : l'adresse de l'objet devient celle du profil.
    if (!profile.location_data) {
      await admin
        .from("profiles")
        .update({ location_data: { address: d.location.address, lat: d.location.lat, lng: d.location.lng } })
        .eq("id", user.id);
    }

    await admin.storage.from(DRAFT_BUCKET).remove(draft.photo_paths);
    return { status: "published", listing_id: listing.id };
  } catch (e) {
    if (copied.length) await admin.storage.from(PHOTO_BUCKET).remove(copied);
    await admin
      .from("listing_drafts")
      .update({ status: "failed", error: e instanceof Error ? e.message.slice(0, 500) : "unknown" })
      .eq("id", draft.id);
    throw e;
  }
}

// ─── cleanup (cron) ────────────────────────────────────────────────────────

async function cleanup(admin: SupabaseClient) {
  const cutoff = new Date(Date.now() - DRAFT_TTL_DAYS * 24 * 3600 * 1000).toISOString();
  const { data: stale, error } = await admin
    .from("listing_drafts")
    .select("id, photo_paths")
    .neq("status", "published")
    .lt("created_at", cutoff)
    .limit(200);
  if (error) throw error;
  let removed = 0;
  for (const d of stale ?? []) {
    if (d.photo_paths?.length) await admin.storage.from(DRAFT_BUCKET).remove(d.photo_paths);
    const { error: delErr } = await admin.from("listing_drafts").delete().eq("id", d.id);
    if (!delErr) removed++;
  }
  return { removed };
}

// ─── helpers ───────────────────────────────────────────────────────────────

async function draftByToken(admin: SupabaseClient, token: unknown): Promise<DraftRow> {
  const t = str(token);
  if (t.length < 20 || t.length > 100) throw new HttpError(400, "invalid_token");
  const { data, error } = await admin
    .from("listing_drafts")
    .select("id, status, data, photo_paths, claimed_by, claimed_at, listing_id")
    .eq("token_hash", await sha256Hex(t))
    .maybeSingle();
  if (error) throw error;
  if (!data) throw new HttpError(404, "draft_not_found");
  return data as DraftRow;
}

function str(v: unknown): string {
  return typeof v === "string" ? v : "";
}

function num(v: unknown): number {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v.trim() !== "") return Number(v.replace(",", "."));
  return NaN;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("cf-connecting-ip") ?? req.headers.get("x-real-ip") ?? "unknown";
}

function randomToken(): string {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
}

async function sha256Hex(s: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(s));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("");
}
