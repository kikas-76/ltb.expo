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
      const { data: bookingDetail } = await supabase
        .from("bookings")
        .select("stripe_payment_intent_id")
        .eq("id", booking.id)
        .maybeSingle();

      const updateData: Record<string, any> = {
        status: "completed",
        owner_validated: true,
      };

      if (bookingDetail?.stripe_payment_intent_id) {
        updateData.deposit_action = "release";
        updateData.deposit_released_at = new Date().toISOString();
      }

      const { error: updateError } = await supabase
        .from("bookings")
        .update(updateData)
        .eq("id", booking.id);

      if (!updateError) {
        if (bookingDetail?.stripe_payment_intent_id) {
          const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
          if (stripeKey) {
            await fetch(
              `https://api.stripe.com/v1/payment_intents/${bookingDetail.stripe_payment_intent_id}/cancel`,
              {
                method: "POST",
                headers: {
                  "Authorization": `Bearer ${stripeKey}`,
                  "Content-Type": "application/x-www-form-urlencoded",
                },
              }
            );
          }
        }

        if (booking.conversation_id) {
          await supabase.from("chat_messages").insert({
            conversation_id: booking.conversation_id,
            sender_id: null,
            content: "Location validée automatiquement — Le délai de 24h est écoulé sans signalement de problème. La caution a été libérée.",
            is_system: true,
            is_read: false,
          });
          results.push({ id: booking.id, status: "auto_completed" });
        }
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
