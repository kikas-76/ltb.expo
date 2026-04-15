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
    const { access_token, booking_id, success_url, cancel_url } = await req.json();

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
        listing:listings(name, renter_fee_percent, owner_commission_percent),
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

    const renterFeePercent = booking.listing?.renter_fee_percent ?? 7;
    const ownerCommissionPercent = booking.listing?.owner_commission_percent ?? 8;

    const rentalAmount = Math.round(booking.total_price * 100);
    const renterFee = Math.round(rentalAmount * renterFeePercent / 100);
    const ownerCommission = Math.round(rentalAmount * ownerCommissionPercent / 100);
    const applicationFee = renterFee + ownerCommission;
    const depositAmount = Math.round(booking.deposit_amount * 100);

    const ownerStripeAccountId = booking.owner_profile?.stripe_account_id;
    const listingName = booking.listing?.name ?? "Location";

    const stripeHeaders = {
      "Authorization": `Bearer ${stripeKey}`,
      "Content-Type": "application/x-www-form-urlencoded",
    };

    const baseSuccessUrl = success_url || "https://loueton bien.app/payment-success";
    const baseCancelUrl = cancel_url || "https://loueton bien.app/";

    const sessionBody = new URLSearchParams({
      "mode": "payment",
      "payment_method_types[0]": "card",
      "line_items[0][price_data][currency]": "eur",
      "line_items[0][price_data][product_data][name]": `Location — ${listingName}`,
      "line_items[0][price_data][unit_amount]": String(rentalAmount + renterFee),
      "line_items[0][quantity]": "1",
      "line_items[1][price_data][currency]": "eur",
      "line_items[1][price_data][product_data][name]": "Caution (bloquée et remboursée au retour)",
      "line_items[1][price_data][unit_amount]": String(depositAmount),
      "line_items[1][quantity]": "1",
      "success_url": `${baseSuccessUrl}?booking_id=${booking_id}&session_id={CHECKOUT_SESSION_ID}`,
      "cancel_url": `${baseCancelUrl}payment/${booking_id}`,
      "metadata[booking_id]": booking_id,
      "metadata[user_id]": user.id,
      "customer_email": user.email ?? "",
    });

    if (ownerStripeAccountId) {
      sessionBody.set("payment_intent_data[transfer_data][destination]", ownerStripeAccountId);
      sessionBody.set("payment_intent_data[application_fee_amount]", String(applicationFee));
    }

    const sessionRes = await fetch("https://api.stripe.com/v1/checkout/sessions", {
      method: "POST",
      headers: stripeHeaders,
      body: sessionBody.toString(),
    });

    const session = await sessionRes.json();

    if (session.error) {
      return new Response(
        JSON.stringify({ error: session.error.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    await supabaseAdmin
      .from("bookings")
      .update({ stripe_checkout_session_id: session.id })
      .eq("id", booking_id);

    return new Response(
      JSON.stringify({ checkout_url: session.url, session_id: session.id }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message ?? "Erreur interne" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
