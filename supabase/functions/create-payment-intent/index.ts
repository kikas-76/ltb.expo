import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

async function stripePost(path: string, body: URLSearchParams, key: string, stripeAccount?: string) {
  const headers: Record<string, string> = {
    "Authorization": `Bearer ${key}`,
    "Content-Type": "application/x-www-form-urlencoded",
    "Stripe-Version": "2024-06-20",
  };
  if (stripeAccount) headers["Stripe-Account"] = stripeAccount;
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers,
    body: body.toString(),
  });
  return res.json();
}

async function stripeGet(path: string, key: string) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: {
      "Authorization": `Bearer ${key}`,
      "Stripe-Version": "2024-06-20",
    },
  });
  return res.json();
}

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
        listing:listings(name, renter_fee_percent, owner_commission_percent, deposit_amount),
        owner_profile:profiles!bookings_owner_id_fkey(stripe_account_id, stripe_charges_enabled)
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

    if (booking.status !== "pending_payment") {
      return new Response(
        JSON.stringify({ error: "Cette réservation ne peut pas être payée (statut actuel : " + booking.status + ")." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Idempotency: if a rental PI already exists for this booking, return it instead of creating a new one
    if (booking.stripe_transfer_id) {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (stripeKey) {
        const existingPI = await stripeGet(`/payment_intents/${booking.stripe_transfer_id}`, stripeKey);
        if (existingPI && !existingPI.error && existingPI.client_secret) {
          return new Response(
            JSON.stringify({
              rental_client_secret: existingPI.client_secret,
              rental_payment_intent_id: existingPI.id,
              deposit_amount: booking.deposit_amount ?? 0,
            }),
            { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: "Stripe non configuré" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: renterProfile } = await supabaseAdmin
      .from("profiles")
      .select("stripe_customer_id, email")
      .eq("id", user.id)
      .maybeSingle();

    let customerId: string | null = renterProfile?.stripe_customer_id ?? null;

    if (!customerId) {
      const email = user.email ?? renterProfile?.email ?? undefined;
      const customerBody = new URLSearchParams({ "metadata[user_id]": user.id });
      if (email) customerBody.set("email", email);
      const customer = await stripePost("/customers", customerBody, stripeKey);
      if (customer.error) {
        return new Response(
          JSON.stringify({ error: customer.error.message }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
      customerId = customer.id;
      await supabaseAdmin
        .from("profiles")
        .update({ stripe_customer_id: customerId })
        .eq("id", user.id);
    } else {
      const existing = await stripeGet(`/customers/${customerId}`, stripeKey);
      if (existing.deleted || existing.error) {
        const email = user.email ?? renterProfile?.email ?? undefined;
        const customerBody = new URLSearchParams({ "metadata[user_id]": user.id });
        if (email) customerBody.set("email", email);
        const customer = await stripePost("/customers", customerBody, stripeKey);
        if (customer.error) {
          return new Response(
            JSON.stringify({ error: customer.error.message }),
            { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
        customerId = customer.id;
        await supabaseAdmin
          .from("profiles")
          .update({ stripe_customer_id: customerId })
          .eq("id", user.id);
      }
    }

    const ownerStripeAccountId = booking.owner_profile?.stripe_account_id;

    if (!ownerStripeAccountId) {
      return new Response(
        JSON.stringify({ error: "Le propriétaire n'a pas encore configuré son compte de paiement. Impossible de procéder au paiement." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!booking.owner_profile?.stripe_charges_enabled) {
      return new Response(
        JSON.stringify({ error: "Le compte de paiement du propriétaire n'est pas encore activé. Impossible de procéder au paiement." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const renterFeePercent = booking.listing?.renter_fee_percent ?? 7;
    const ownerCommissionPercent = booking.listing?.owner_commission_percent ?? 8;

    const rentalAmount = Math.round(booking.total_price * 100);
    const renterFee = Math.round(rentalAmount * renterFeePercent / 100);
    const ownerCommission = Math.round(rentalAmount * ownerCommissionPercent / 100);
    const applicationFee = renterFee + ownerCommission;

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

    const rentalBody = new URLSearchParams({
      amount: String(rentalAmount + renterFee),
      currency: "eur",
      customer: customerId!,
      setup_future_usage: "off_session",
      "metadata[booking_id]": booking_id,
      "metadata[type]": "rental",
    });

    if (ownerStripeAccountId) {
      rentalBody.set("transfer_data[destination]", ownerStripeAccountId);
      rentalBody.set("application_fee_amount", String(applicationFee));
    }

    const rentalIntent = await stripePost("/payment_intents", rentalBody, stripeKey);
    if (rentalIntent.error) {
      return new Response(
        JSON.stringify({ error: rentalIntent.error.message }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deposit is NOT charged at payment time — it will be held 2 days before
    // the rental ends via the hold-deposit cron function. The renter's card is
    // saved via setup_future_usage: "off_session" on the rental intent.

    return new Response(
      JSON.stringify({
        rental_client_secret: rentalIntent.client_secret,
        rental_payment_intent_id: rentalIntent.id,
        deposit_amount: rawDeposit,
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
