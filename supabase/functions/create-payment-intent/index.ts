import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { access_token, booking_id } = await req.json();

    if (!access_token || !booking_id) {
      return new Response(
        JSON.stringify({ error: "access_token et booking_id requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(access_token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Non authentifié" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select(`
        *,
        listing:listings(name, platform_fee_percent, deposit_amount),
        owner_profile:profiles!bookings_owner_id_fkey(stripe_account_id)
      `)
      .eq("id", booking_id)
      .eq("renter_id", user.id)
      .maybeSingle();

    if (bookingError || !booking) {
      return new Response(
        JSON.stringify({ error: "Réservation introuvable" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: "Stripe non configuré" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const ownerStripeAccountId = booking.owner_profile?.stripe_account_id;

    const feePercent = 0.07;
    const rentalAmount = Math.round(booking.total_price * 100);
    const serviceFee = Math.round(booking.total_price * feePercent * 100);

    const rawDeposit = (!booking.deposit_amount || booking.deposit_amount === 0)
      ? (booking.listing?.deposit_amount ?? 0)
      : booking.deposit_amount;

    if (rawDeposit > 0 && (!booking.deposit_amount || booking.deposit_amount === 0)) {
      await supabaseAdmin
        .from("bookings")
        .update({ deposit_amount: rawDeposit })
        .eq("id", booking_id);
    }

    const depositAmount = Math.round(rawDeposit * 100);

    const stripeHeaders = {
      "Authorization": `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": "2024-06-20",
    };

    const rentalBody = new URLSearchParams({
      amount: String(rentalAmount + serviceFee),
      currency: "eur",
      "metadata[booking_id]": booking_id,
      "metadata[type]": "rental",
    });

    if (ownerStripeAccountId) {
      rentalBody.set("transfer_data[destination]", ownerStripeAccountId);
      rentalBody.set("application_fee_amount", String(serviceFee));
    }

    const rentalRes = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: stripeHeaders,
      body: rentalBody.toString(),
    });

    const rentalIntent = await rentalRes.json();
    if (rentalIntent.error) {
      return new Response(
        JSON.stringify({ error: rentalIntent.error.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const depositBody = new URLSearchParams({
      amount: String(depositAmount),
      currency: "eur",
      capture_method: "manual",
      "metadata[booking_id]": booking_id,
      "metadata[type]": "deposit",
    });

    const depositRes = await fetch("https://api.stripe.com/v1/payment_intents", {
      method: "POST",
      headers: stripeHeaders,
      body: depositBody.toString(),
    });

    const depositIntent = await depositRes.json();
    if (depositIntent.error) {
      return new Response(
        JSON.stringify({ error: depositIntent.error.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({
        rental_client_secret: rentalIntent.client_secret,
        deposit_client_secret: depositIntent.client_secret,
        rental_payment_intent_id: rentalIntent.id,
        deposit_payment_intent_id: depositIntent.id,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message ?? "Erreur interne" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
