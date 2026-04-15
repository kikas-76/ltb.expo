import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization") ?? "";
    const accessToken = authHeader.replace("Bearer ", "").trim();

    if (!accessToken) {
      return new Response(
        JSON.stringify({ error: "Non authentifié" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(accessToken);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Non authentifié" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body = await req.json();
    const { event, conversation_id, booking_id } = body;

    if (!event) {
      return new Response(
        JSON.stringify({ error: "event requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const internalSecret = Deno.env.get("INTERNAL_EDGE_SECRET");
    const invokeHeaders = internalSecret ? { "x-internal-secret": internalSecret } : {};

    async function dispatchEmail(to: string, template: string, data: Record<string, any>) {
      try {
        await supabaseAdmin.functions.invoke("send-email", {
          headers: invokeHeaders,
          body: { to, template, data },
        });
      } catch (err) {
        console.error(`Email dispatch failed (${template}):`, err);
      }
    }

    if (event === "booking_accepted" || event === "booking_rejected") {
      if (!conversation_id) {
        return new Response(
          JSON.stringify({ error: "conversation_id requis" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: conv } = await supabaseAdmin
        .from("conversations")
        .select(`
          id, owner_id, requester_id,
          listing:listings(name),
          owner:profiles!conversations_owner_id_fkey(username),
          requester:profiles!conversations_requester_id_fkey(email)
        `)
        .eq("id", conversation_id)
        .maybeSingle();

      if (!conv) {
        return new Response(
          JSON.stringify({ error: "Conversation introuvable" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if ((conv as any).owner_id !== user.id) {
        return new Response(
          JSON.stringify({ error: "Accès refusé — seul le propriétaire peut déclencher cet événement" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const renterEmail = (conv.requester as any)?.email ?? null;
      if (!renterEmail) {
        return new Response(
          JSON.stringify({ success: true, event, skipped: "no renter email" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const ownerName = (conv.owner as any)?.username ?? "le propriétaire";
      const listingName = (conv.listing as any)?.name ?? "Location";

      if (event === "booking_accepted") {
        const { data: bookingRow } = await supabaseAdmin
          .from("bookings")
          .select("id, total_price, deposit_amount, start_date, end_date, conversation_id")
          .eq("conversation_id", conversation_id)
          .maybeSingle();

        await dispatchEmail(renterEmail, "booking_accepted_renter", {
          listing_name: listingName,
          owner_name: ownerName,
          start_date: bookingRow?.start_date ? formatDate(bookingRow.start_date) : "",
          end_date: bookingRow?.end_date ? formatDate(bookingRow.end_date) : "",
          total_price: bookingRow?.total_price ?? 0,
          deposit: bookingRow?.deposit_amount ?? 0,
          booking_id: bookingRow?.id ?? "",
        });
      } else {
        await dispatchEmail(renterEmail, "booking_rejected_renter", {
          listing_name: listingName,
          owner_name: ownerName,
        });
      }

      return new Response(
        JSON.stringify({ success: true, event }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (event === "deposit_released") {
      if (!booking_id) {
        return new Response(
          JSON.stringify({ error: "booking_id requis" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: bookingRow } = await supabaseAdmin
        .from("bookings")
        .select(`
          owner_id, renter_id, deposit_amount,
          listing:listings(name),
          owner:profiles!bookings_owner_id_fkey(username)
        `)
        .eq("id", booking_id)
        .maybeSingle();

      if (!bookingRow) {
        return new Response(
          JSON.stringify({ error: "Réservation introuvable" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if ((bookingRow as any).owner_id !== user.id) {
        return new Response(
          JSON.stringify({ error: "Accès refusé — seul le propriétaire peut libérer la caution" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: renterProfile } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("id", (bookingRow as any).renter_id)
        .maybeSingle();

      if (renterProfile?.email) {
        await dispatchEmail(renterProfile.email, "deposit_released", {
          listing_name: (bookingRow.listing as any)?.name ?? "Location",
          deposit: (bookingRow as any).deposit_amount ?? 0,
          owner_name: (bookingRow.owner as any)?.username ?? "le propriétaire",
        });
      }

      return new Response(
        JSON.stringify({ success: true, event }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (event === "dispute_opened") {
      if (!booking_id) {
        return new Response(
          JSON.stringify({ error: "booking_id requis" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: bookingRow } = await supabaseAdmin
        .from("bookings")
        .select("owner_id, renter_id, deposit_amount, start_date, end_date, listing:listings(name)")
        .eq("id", booking_id)
        .maybeSingle();

      if (!bookingRow) {
        return new Response(
          JSON.stringify({ error: "Réservation introuvable" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if ((bookingRow as any).owner_id !== user.id && (bookingRow as any).renter_id !== user.id) {
        return new Response(
          JSON.stringify({ error: "Accès refusé — vous n'êtes pas impliqué dans cette réservation" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: disputeRow } = await supabaseAdmin
        .from("disputes")
        .select("id")
        .eq("booking_id", booking_id)
        .maybeSingle();

      if (!disputeRow) {
        return new Response(
          JSON.stringify({ error: "Aucun litige trouvé pour cette réservation" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const emailData = {
        listing_name: (bookingRow.listing as any)?.name ?? "Location",
        start_date: formatDate((bookingRow as any).start_date),
        end_date: formatDate((bookingRow as any).end_date),
        deposit: (bookingRow as any).deposit_amount ?? 0,
        dispute_id: disputeRow.id,
      };

      const { data: renterP } = await supabaseAdmin
        .from("profiles").select("email").eq("id", (bookingRow as any).renter_id).maybeSingle();
      const { data: ownerP } = await supabaseAdmin
        .from("profiles").select("email").eq("id", (bookingRow as any).owner_id).maybeSingle();

      if (renterP?.email) await dispatchEmail(renterP.email, "dispute_opened", emailData);
      if (ownerP?.email) await dispatchEmail(ownerP.email, "dispute_opened", emailData);

      return new Response(
        JSON.stringify({ success: true, event }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Événement inconnu: ${event}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message ?? "Erreur interne" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
