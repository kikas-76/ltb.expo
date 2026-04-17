import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, x-internal-secret",
};

async function stripeGet(path: string, key: string) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: {
      "Authorization": `Bearer ${key}`,
      "Stripe-Version": "2024-06-20",
    },
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
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const internalSecret = Deno.env.get("INTERNAL_EDGE_SECRET");
    const providedSecret = req.headers.get("x-internal-secret")?.trim() ?? "";
    let bookingIdsFilter: string[] | null = null;

    // Accept either internal secret (cron) or specific booking_ids (from finalize)
    try {
      const body = await req.json();
      bookingIdsFilter = body?.booking_ids ?? null;
      if (!internalSecret || providedSecret !== internalSecret) {
        if (!body?.internal_secret || body.internal_secret !== internalSecret) {
          return new Response(
            JSON.stringify({ error: "Non autorise" }),
            { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
          );
        }
      }
    } catch {
      if (!internalSecret || providedSecret !== internalSecret) {
        return new Response(
          JSON.stringify({ error: "Non autorise" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: "Stripe non configure" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Find bookings needing deposit hold
    let query = supabase
      .from("bookings")
      .select(`
        id, renter_id, deposit_amount, end_date, conversation_id,
        listing:listings(name),
        renter:profiles!bookings_renter_id_fkey(stripe_customer_id, email, username),
        owner:profiles!bookings_owner_id_fkey(email, username)
      `)
      .in("status", ["active", "in_progress", "pending_return"])
      .gt("deposit_amount", 0)
      .is("stripe_payment_intent_id", null)
      .eq("deposit_hold_failed", false);

    if (bookingIdsFilter && bookingIdsFilter.length > 0) {
      query = query.in("id", bookingIdsFilter);
    } else {
      // Cron mode: only bookings ending within 2 days
      const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000).toISOString();
      query = query.lte("end_date", twoDaysFromNow);
    }

    const { data: bookings, error } = await query;

    if (error) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const results: any[] = [];

    for (const booking of bookings ?? []) {
      const customerId = (booking.renter as any)?.stripe_customer_id;
      if (!customerId) {
        console.error(`Booking ${booking.id}: renter has no stripe_customer_id`);
        await supabase.from("bookings").update({ deposit_hold_failed: true }).eq("id", booking.id);
        results.push({ id: booking.id, status: "failed", reason: "no_customer_id" });
        continue;
      }

      // Get the renter's saved payment methods
      const paymentMethods = await stripeGet(
        `/customers/${customerId}/payment_methods?type=card&limit=1`,
        stripeKey
      );

      if (paymentMethods.error || !paymentMethods.data?.length) {
        console.error(`Booking ${booking.id}: no saved payment method`);
        await supabase.from("bookings").update({ deposit_hold_failed: true }).eq("id", booking.id);

        // Notify both parties
        const listingName = (booking.listing as any)?.name ?? "Location";
        const renterEmail = (booking.renter as any)?.email;
        const ownerEmail = (booking.owner as any)?.email;

        if (renterEmail) {
          try {
            await supabase.functions.invoke("send-email", {
              headers: internalSecret ? { "x-internal-secret": internalSecret } : {},
              body: {
                to: renterEmail,
                template: "deposit_hold_failed",
                data: { listing_name: listingName, deposit: booking.deposit_amount },
              },
            });
          } catch (e) { console.error("Email failed:", e); }
        }
        if (ownerEmail) {
          try {
            await supabase.functions.invoke("send-email", {
              headers: internalSecret ? { "x-internal-secret": internalSecret } : {},
              body: {
                to: ownerEmail,
                template: "deposit_hold_failed",
                data: { listing_name: listingName, deposit: booking.deposit_amount },
              },
            });
          } catch (e) { console.error("Email failed:", e); }
        }

        results.push({ id: booking.id, status: "failed", reason: "no_payment_method" });
        continue;
      }

      const pmId = paymentMethods.data[0].id;
      const depositCents = Math.round(booking.deposit_amount * 100);

      // Create off-session manual-capture PaymentIntent
      const piBody = new URLSearchParams({
        amount: String(depositCents),
        currency: "eur",
        customer: customerId,
        payment_method: pmId,
        capture_method: "manual",
        confirm: "true",
        off_session: "true",
        "metadata[booking_id]": booking.id,
        "metadata[type]": "deposit_hold",
      });

      const pi = await stripePost("/payment_intents", piBody, stripeKey);

      if (pi.error) {
        console.error(`Booking ${booking.id}: Stripe PI creation failed:`, pi.error.message);
        await supabase.from("bookings").update({ deposit_hold_failed: true }).eq("id", booking.id);

        const listingName = (booking.listing as any)?.name ?? "Location";
        const renterEmail = (booking.renter as any)?.email;
        const ownerEmail = (booking.owner as any)?.email;

        if (renterEmail) {
          try {
            await supabase.functions.invoke("send-email", {
              headers: internalSecret ? { "x-internal-secret": internalSecret } : {},
              body: {
                to: renterEmail,
                template: "deposit_hold_failed",
                data: { listing_name: listingName, deposit: booking.deposit_amount },
              },
            });
          } catch (e) { console.error("Email failed:", e); }
        }
        if (ownerEmail) {
          try {
            await supabase.functions.invoke("send-email", {
              headers: internalSecret ? { "x-internal-secret": internalSecret } : {},
              body: {
                to: ownerEmail,
                template: "deposit_hold_failed",
                data: { listing_name: listingName, deposit: booking.deposit_amount },
              },
            });
          } catch (e) { console.error("Email failed:", e); }
        }

        results.push({ id: booking.id, status: "failed", reason: pi.error.message });
        continue;
      }

      // Success: update booking with the new deposit PI
      await supabase.from("bookings").update({
        stripe_payment_intent_id: pi.id,
        deposit_authorized_at: new Date().toISOString(),
        deposit_action: "authorize",
      }).eq("id", booking.id);

      // Notify renter
      const listingName = (booking.listing as any)?.name ?? "Location";
      const renterEmail = (booking.renter as any)?.email;
      if (renterEmail) {
        try {
          await supabase.functions.invoke("send-email", {
            headers: internalSecret ? { "x-internal-secret": internalSecret } : {},
            body: {
              to: renterEmail,
              template: "deposit_hold_created",
              data: { listing_name: listingName, deposit: booking.deposit_amount },
            },
          });
        } catch (e) { console.error("Email failed:", e); }
      }

      console.log(`Booking ${booking.id}: deposit hold created (${pi.id})`);
      results.push({ id: booking.id, status: "hold_created", payment_intent: pi.id });
    }

    return new Response(
      JSON.stringify({ success: true, processed: results.length, results }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (err: any) {
    console.error("hold-deposit error:", err);
    return new Response(
      JSON.stringify({ error: err.message ?? "Erreur interne" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
