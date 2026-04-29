import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, preflightResponse, type CorsOptions } from "../_shared/cors.ts";

const corsOpts: CorsOptions = { methods: "POST, OPTIONS" };

const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const INTERNAL_EDGE_SECRET = Deno.env.get("INTERNAL_EDGE_SECRET");

// Auth: only server-to-server callers may dispatch admin templates.
// Without this gate, a regular signed-in user could call this function
// (verify_jwt: true accepts ANY user JWT) and trigger arbitrary
// templates — including "reset_password" / "email_verification" — to
// any recipient with attacker-controlled URLs in the data payload.
// Phishing-as-a-service. Mirrors the auth model used by send-email.
function isAuthorizedServerCaller(req: Request, body: Record<string, any>): boolean {
  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : authHeader.trim();

  const apiKey = req.headers.get("apikey")?.trim() ?? "";
  const internalSecret =
    req.headers.get("x-internal-secret")?.trim() ??
    String(body?.internal_secret ?? "").trim();

  const isServiceRole =
    !!SERVICE_ROLE_KEY &&
    (bearer === SERVICE_ROLE_KEY || apiKey === SERVICE_ROLE_KEY);

  const isInternal =
    !!INTERNAL_EDGE_SECRET && internalSecret === INTERNAL_EDGE_SECRET;

  return isServiceRole || isInternal;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req, corsOpts);
  }
  const corsHeaders = buildCorsHeaders(req, corsOpts);

  try {
    const body = await req.json();

    if (!isAuthorizedServerCaller(req, body)) {
      return new Response(JSON.stringify({ error: "Forbidden" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { to, template, data } = body ?? {};

    if (!to || !template) {
      return new Response(JSON.stringify({ error: "Missing to or template" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { error } = await supabaseAdmin.functions.invoke("send-email", {
      headers: INTERNAL_EDGE_SECRET ? { "x-internal-secret": INTERNAL_EDGE_SECRET } : {},
      body: { to, template, data: data ?? {} },
    });

    if (error) {
      return new Response(JSON.stringify({ error: error.message ?? "Email send failed" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
