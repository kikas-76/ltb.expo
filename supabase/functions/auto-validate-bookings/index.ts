import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const deadline = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    const { data: bookings, error } = await supabase
      .from("bookings")
      .select("id, conversation_id")
      .eq("status", "pending_owner_validation")
      .not("return_confirmed_at", "is", null)
      .lt("return_confirmed_at", deadline);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const results = [];
    for (const booking of (bookings ?? [])) {
      const { error: updateError } = await supabase
        .from("bookings")
        .update({ status: "completed", owner_validated: true })
        .eq("id", booking.id);

      if (!updateError && booking.conversation_id) {
        await supabase.from("chat_messages").insert({
          conversation_id: booking.conversation_id,
          sender_id: null,
          content: "Location validée automatiquement — Le délai de 24h est écoulé sans signalement de problème. La caution a été libérée.",
          is_system: true,
        });
        results.push({ id: booking.id, status: "auto_completed" });
      }
    }

    return new Response(JSON.stringify({ processed: results.length, bookings: results }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
