import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { constantTimeEquals, requireEnv } from "../_shared/auth.ts";

// Crash at boot if cron secret is missing — better than silently 401-ing
// every cron tick and never being noticed.
const INTERNAL_SECRET = requireEnv("INTERNAL_EDGE_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-internal-secret",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(
      JSON.stringify({ error: "Method not allowed" }),
      { status: 405, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }

  try {
    const internalSecret = req.headers.get("x-internal-secret");

    if (!constantTimeEquals(internalSecret, INTERNAL_SECRET)) {
      return new Response(
        JSON.stringify({ error: "Unauthorized" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const deadline = new Date(Date.now() - 24 * 3600 * 1000).toISOString();

    const { data: bookings, error } = await supabase
      .from("bookings")
      .select(`
        id, conversation_id, stripe_payment_intent_id,
        listing:listings(name),
        renter:profiles!bookings_renter_id_fkey(email),
        owner:profiles!bookings_owner_id_fkey(email)
      `)
      .eq("status", "pending_owner_validation")
      .not("return_confirmed_at", "is", null)
      .lt("return_confirmed_at", deadline);

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    async function dispatchEmail(to: string, template: string, data: Record<string, unknown>) {
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
            "apikey": SERVICE_ROLE_KEY,
            "x-internal-secret": INTERNAL_SECRET,
          },
          body: JSON.stringify({ to, template, data }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          console.error(`auto-validate send-email ${template} → ${res.status}: ${body.slice(0, 200)}`);
        }
      } catch (err) {
        console.error(`auto-validate email dispatch failed (${template}):`, err);
      }
    }

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    const results = [];

    for (const booking of (bookings ?? [])) {
      const updateData: Record<string, any> = {
        status: "completed",
        owner_validated: true,
      };

      // Try to cancel the deposit hold BEFORE marking it released, so the DB
      // never claims released when the auth still sits on the renter's card.
      if (booking.stripe_payment_intent_id && stripeKey) {
        try {
          const cancelRes = await fetch(
            `https://api.stripe.com/v1/payment_intents/${booking.stripe_payment_intent_id}/cancel`,
            {
              method: "POST",
              headers: {
                "Authorization": `Bearer ${stripeKey}`,
                "Content-Type": "application/x-www-form-urlencoded",
              },
            }
          );
          const cancelData = await cancelRes.json();
          // Accept "already canceled" as success (idempotent)
          const alreadyTerminal = cancelData?.error?.code === "payment_intent_unexpected_state";
          if (cancelRes.ok || alreadyTerminal) {
            updateData.deposit_action = "release";
            updateData.deposit_released_at = new Date().toISOString();
          } else {
            console.error(
              `auto-validate: Stripe cancel failed for booking ${booking.id}:`,
              cancelData?.error
            );
          }
        } catch (e) {
          console.error(`auto-validate: Stripe cancel threw for booking ${booking.id}:`, e);
        }
      }

      const { error: updateError } = await supabase
        .from("bookings")
        .update(updateData)
        .eq("id", booking.id);

      if (!updateError && booking.conversation_id) {
        await supabase.from("chat_messages").insert({
          conversation_id: booking.conversation_id,
          sender_id: null,
          content: "Location validée automatiquement. Le délai de 24h est écoulé sans signalement de problème. La caution a été libérée.",
          is_system: true,
          is_read: false,
        });

        const data = {
          listing_name: (booking as any).listing?.name ?? "ta location",
          booking_id: booking.id,
          deposit_released: !!updateData.deposit_released_at,
        };
        const renterEmail = (booking as any).renter?.email;
        const ownerEmail = (booking as any).owner?.email;
        if (renterEmail) await dispatchEmail(renterEmail, "booking_completed", data);
        if (ownerEmail) await dispatchEmail(ownerEmail, "booking_completed", data);

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
