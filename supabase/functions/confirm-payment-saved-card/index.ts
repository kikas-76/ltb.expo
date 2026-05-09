import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, preflightResponse, type CorsOptions } from "../_shared/cors.ts";

// 1-click payment confirmation : confirms the booking's rental
// PaymentIntent with a payment method already attached to the renter's
// Stripe customer. Used when the renter has paid us at least once before
// (the create-payment-intent endpoint always sets
// setup_future_usage="off_session" so any first card lands on the
// customer for re-use).
//
// Auth : JWT only. Body : { booking_id, payment_method_id }.
// Verifies the PM belongs to the renter's customer before confirming —
// without that check, a malicious caller could try a victim's pm_id.

const corsOpts: CorsOptions = { methods: "POST, OPTIONS" };

async function stripeGet(path: string, key: string) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "GET",
    headers: { "Authorization": `Bearer ${key}`, "Stripe-Version": "2024-06-20" },
  });
  return res.json();
}

async function stripePost(path: string, body: URLSearchParams, key: string) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": "2024-06-20",
    },
    body: body.toString(),
  });
  return res.json();
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflightResponse(req, corsOpts);
  const corsHeaders = buildCorsHeaders(req, corsOpts);

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
    const booking_id = String(body?.booking_id ?? "").trim();
    const payment_method_id = String(body?.payment_method_id ?? "").trim();
    const return_url = typeof body?.return_url === "string" ? body.return_url : null;

    if (!booking_id || !payment_method_id) {
      return new Response(
        JSON.stringify({ error: "booking_id et payment_method_id requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: "Stripe non configuré" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Booking + renter ownership check (RLS would also gate this but the
    // service-role client bypasses RLS so we re-verify explicitly).
    const { data: booking } = await supabaseAdmin
      .from("bookings")
      .select("id, renter_id, status, stripe_rental_payment_intent_id")
      .eq("id", booking_id)
      .maybeSingle();

    if (!booking) {
      return new Response(
        JSON.stringify({ error: "Réservation introuvable" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (booking.renter_id !== user.id) {
      return new Response(
        JSON.stringify({ error: "Tu n'es pas le locataire de cette réservation" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (!booking.stripe_rental_payment_intent_id) {
      return new Response(
        JSON.stringify({ error: "Aucun paiement à confirmer pour cette réservation" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: renter } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!renter?.stripe_customer_id) {
      return new Response(
        JSON.stringify({ error: "Aucun client Stripe associé" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Anti-tampering : the PM must belong to the renter's customer.
    const pm = await stripeGet(`/payment_methods/${payment_method_id}`, stripeKey);
    if (pm?.error) {
      return new Response(
        JSON.stringify({ error: pm.error.message ?? "Carte introuvable" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (pm.customer !== renter.stripe_customer_id) {
      return new Response(
        JSON.stringify({ error: "Cette carte n'appartient pas à ton compte" }),
        { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const confirmBody = new URLSearchParams({
      payment_method: payment_method_id,
    });
    if (return_url) confirmBody.set("return_url", return_url);

    const confirmed = await stripePost(
      `/payment_intents/${booking.stripe_rental_payment_intent_id}/confirm`,
      confirmBody,
      stripeKey
    );

    if (confirmed?.error) {
      return new Response(
        JSON.stringify({ error: confirmed.error.message ?? "Échec de la confirmation" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // The webhook (stripe-webhook → finalize-booking-payment) will flip
    // the booking to active when payment_intent.succeeded fires. We just
    // surface the current status / next_action so the client can show
    // a 3DS challenge if needed.
    return new Response(
      JSON.stringify({
        success: true,
        status: confirmed.status,
        requires_action: confirmed.status === "requires_action",
        client_secret: confirmed.client_secret,
        payment_intent_id: confirmed.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("confirm-payment-saved-card error:", err);
    return new Response(
      JSON.stringify({ error: err?.message ?? "Erreur interne" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
