import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { constantTimeEquals, requireEnv } from "../_shared/auth.ts";

// Crash at boot if cron secret is missing — see hold-deposit for rationale.
const INTERNAL_SECRET = requireEnv("INTERNAL_EDGE_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-internal-secret",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const internalSecret = req.headers.get("x-internal-secret");

    if (!constantTimeEquals(internalSecret, INTERNAL_SECRET)) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseServiceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    const cutoff = new Date(Date.now() - 30 * 60 * 1000).toISOString();

    const { data: staleBookings, error: fetchError } = await supabase
      .from("bookings")
      .select("id, conversation_id, status")
      .eq("status", "pending_payment")
      .lt("created_at", cutoff);

    if (fetchError) {
      return new Response(
        JSON.stringify({ error: fetchError.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!staleBookings || staleBookings.length === 0) {
      return new Response(
        JSON.stringify({ success: true, expired_count: 0, booking_ids: [] }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const expiredIds: string[] = [];

    for (const booking of staleBookings) {
      const { error: bookingUpdateError } = await supabase
        .from("bookings")
        .update({ status: "cancelled" })
        .eq("id", booking.id)
        .eq("status", "pending_payment");

      if (bookingUpdateError) continue;

      expiredIds.push(booking.id);

      if (booking.conversation_id) {
        await supabase
          .from("conversations")
          .update({ status: "cancelled" })
          .eq("id", booking.conversation_id)
          .eq("status", "accepted");

        await supabase.from("chat_messages").insert({
          conversation_id: booking.conversation_id,
          sender_id: null,
          content: "Réservation annulée automatiquement faute de paiement dans le délai imparti.",
          is_system: true,
          is_read: false,
        });
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        expired_count: expiredIds.length,
        booking_ids: expiredIds,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err?.message ?? "Internal error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
