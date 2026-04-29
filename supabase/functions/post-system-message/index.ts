import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, preflightResponse, type CorsOptions } from "../_shared/cors.ts";

const corsOpts: CorsOptions = { methods: "POST, OPTIONS" };

// System-message templates are server-rendered from a fixed event ID. The
// previous version accepted arbitrary `content` from any participant of a
// conversation, which let logged-in users spoof legitimate-looking
// "system" messages ("Demande acceptée par X", "Caution libérée", etc.)
// in any conversation they joined. Restricting input to a whitelist makes
// the chat log trustworthy.
type EventId =
  | "request_accepted"
  | "request_refused"
  | "handover_confirmed_one"
  | "handover_confirmed_both"
  | "return_confirmed_one"
  | "return_confirmed_both"
  | "owner_validated_ok"
  | "listing_unavailable"
  | "dispute_opened"
  | "direct_booking_link"
  | "new_request";

const ALL_EVENTS: ReadonlySet<EventId> = new Set([
  "request_accepted",
  "request_refused",
  "handover_confirmed_one",
  "handover_confirmed_both",
  "return_confirmed_one",
  "return_confirmed_both",
  "owner_validated_ok",
  "listing_unavailable",
  "dispute_opened",
  "direct_booking_link",
  "new_request",
]);

// Events the renter must not be able to trigger (owner-only actions).
const OWNER_ONLY_EVENTS: ReadonlySet<EventId> = new Set([
  "request_accepted",
  "request_refused",
  "listing_unavailable",
]);

// Events the renter only triggers when initiating the conversation flow.
const RENTER_ONLY_EVENTS: ReadonlySet<EventId> = new Set([
  "direct_booking_link",
  "new_request",
]);

// Events that take date params; everything else gets {} as params.
const DATE_PARAM_EVENTS: ReadonlySet<EventId> = new Set([
  "direct_booking_link",
  "new_request",
]);

function jsonError(corsHeaders: Record<string, string>, message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

// YYYY-MM-DD or full ISO accepted; rejects anything that doesn't parse.
function parseISODate(raw: unknown): Date | null {
  if (typeof raw !== "string" || raw.length < 8 || raw.length > 40) return null;
  const d = new Date(raw);
  return Number.isNaN(d.getTime()) ? null : d;
}

function formatFR(d: Date): string {
  return d.toLocaleDateString("fr-FR", { day: "numeric", month: "long" });
}

function renderEvent(
  eventId: EventId,
  actorUsername: string,
  params: Record<string, unknown>,
): string | null {
  switch (eventId) {
    case "request_accepted":
      return `Demande acceptée par ${actorUsername}`;
    case "request_refused":
      return `Demande refusée par ${actorUsername}`;
    case "handover_confirmed_one":
      return `Remise confirmée par ${actorUsername}. En attente de l'autre partie`;
    case "handover_confirmed_both":
      return "Remise confirmée par les deux parties. Location en cours";
    case "return_confirmed_one":
      return `Retour confirmé par ${actorUsername}. En attente de l'autre partie`;
    case "return_confirmed_both":
      return "Retour confirmé par les deux parties. Le propriétaire a 24h pour signaler un problème, sinon la location est validée automatiquement.";
    case "owner_validated_ok":
      return "Location terminée. L'objet a été validé par le propriétaire. La caution a été libérée.";
    case "listing_unavailable":
      return "L'annonce a été supprimée ou masquée. Cette demande n'est plus disponible";
    case "dispute_opened":
      return "Un litige a été ouvert par le propriétaire. La caution reste bloquée jusqu'à résolution";
    case "direct_booking_link": {
      const start = parseISODate(params.start_date);
      const end = parseISODate(params.end_date);
      if (!start || !end) return null;
      return `Réservation directe via lien · Du ${formatFR(start)} au ${formatFR(end)}`;
    }
    case "new_request": {
      const start = parseISODate(params.start_date);
      const end = parseISODate(params.end_date);
      if (!start || !end) return null;
      return `Nouvelle demande du ${formatFR(start)} au ${formatFR(end)}`;
    }
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req, corsOpts);
  }
  const corsHeaders = buildCorsHeaders(req, corsOpts);

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return jsonError(corsHeaders, "Missing authorization", 401);
    }

    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } }
    );

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) {
      return jsonError(corsHeaders, "Unauthorized", 401);
    }

    const body = await req.json();
    const conversation_id = String(body?.conversation_id ?? "").trim();
    const eventId = String(body?.event ?? "").trim() as EventId;
    const params: Record<string, unknown> =
      body?.params && typeof body.params === "object" ? body.params : {};

    if (!conversation_id || !eventId) {
      return jsonError(corsHeaders, "Missing conversation_id or event", 400);
    }
    if (!ALL_EVENTS.has(eventId)) {
      return jsonError(corsHeaders, `Unknown event '${eventId}'`, 400);
    }
    if (DATE_PARAM_EVENTS.has(eventId)) {
      if (!parseISODate(params.start_date) || !parseISODate(params.end_date)) {
        return jsonError(corsHeaders, "Invalid start_date / end_date", 400);
      }
    }

    const { data: conv, error: convError } = await userClient
      .from("conversations")
      .select("id, requester_id, owner_id")
      .eq("id", conversation_id)
      .maybeSingle();

    if (convError || !conv) {
      return jsonError(corsHeaders, "Conversation not found", 404);
    }

    const isOwner = conv.owner_id === user.id;
    const isRenter = conv.requester_id === user.id;
    if (!isOwner && !isRenter) {
      return jsonError(corsHeaders, "Access denied", 403);
    }
    if (OWNER_ONLY_EVENTS.has(eventId) && !isOwner) {
      return jsonError(corsHeaders, "Event reserved for the listing owner", 403);
    }
    if (RENTER_ONLY_EVENTS.has(eventId) && !isRenter) {
      return jsonError(corsHeaders, "Event reserved for the renter", 403);
    }

    const serviceClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Resolve the actor's display name from their profile. We *never* trust
    // a client-supplied username — that would let an attacker inject any
    // string into the rendered template (unicode tricks, fake "Admin", …).
    const { data: actorProfile } = await serviceClient
      .from("profiles")
      .select("username")
      .eq("id", user.id)
      .maybeSingle();

    const actorUsername = (actorProfile?.username ?? "").trim() || "un utilisateur";

    const content = renderEvent(eventId, actorUsername, params);
    if (!content) {
      return jsonError(corsHeaders, "Could not render event", 400);
    }

    const { error: insertError } = await serviceClient
      .from("chat_messages")
      .insert({
        conversation_id,
        sender_id: null,
        content,
        is_system: true,
      });

    if (insertError) {
      return jsonError(corsHeaders, insertError.message, 500);
    }

    return new Response(JSON.stringify({ success: true }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return jsonError(corsHeaders, String(err), 500);
  }
});
