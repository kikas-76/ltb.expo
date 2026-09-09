import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { exchangeAppleAuthorizationCode, isAppleSignInConfigured } from "../_shared/apple.ts";

// Appelée par l'app juste après une connexion Apple réussie, avec le
// `authorizationCode` renvoyé par Apple. Échange ce code contre un refresh
// token conservé chiffré (Vault) pour pouvoir le révoquer à la suppression du
// compte. Ne renvoie jamais d'erreur bloquante : la connexion reste valide
// même si l'échange échoue (clé non configurée, code expiré…).

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const token = (req.headers.get("Authorization") ?? "").replace(/^Bearer\s+/i, "");
  if (!token) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const { data: { user }, error: userError } = await admin.auth.getUser(token);
  if (userError || !user) return json({ error: "Unauthorized" }, 401);

  const body = await req.json().catch(() => ({}));
  const code = typeof body?.code === "string" ? body.code : "";
  if (!code) return json({ stored: false, reason: "missing_code" }, 400);

  if (!isAppleSignInConfigured()) {
    console.warn("apple-token-exchange: APPLE_SIGN_IN_KEY_ID / PRIVATE_KEY non configurés, jeton non conservé");
    return json({ stored: false, reason: "not_configured" });
  }

  try {
    const { refreshToken, error } = await exchangeAppleAuthorizationCode(code);
    if (!refreshToken) {
      console.error(`apple-token-exchange: échange refusé pour ${user.id}: ${error}`);
      return json({ stored: false, reason: error ?? "exchange_failed" });
    }
    const { error: rpcError } = await admin.rpc("store_apple_refresh_token", { p_user: user.id, p_token: refreshToken });
    if (rpcError) {
      console.error(`apple-token-exchange: stockage échoué pour ${user.id}: ${rpcError.message}`);
      return json({ stored: false, reason: "store_failed" });
    }
    return json({ stored: true });
  } catch (err) {
    console.error("apple-token-exchange error:", err);
    return json({ stored: false, reason: "internal_error" });
  }
});
