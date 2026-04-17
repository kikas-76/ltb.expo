import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const PAYABLE_STATUSES = ["pending_payment"];

async function stripeGet(path: string, key: string) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    headers: {
      "Authorization": `Bearer ${key}`,
      "Stripe-Version": "2024-06-20",
    },
  });
  return res.json();
}

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

    const { booking_id, rental_payment_intent_id } = await req.json();

    if (!booking_id) {
      return new Response(
        JSON.stringify({ error: "booking_id requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select(`
        id, status, total_price, deposit_amount, start_date, end_date,
        renter_id, owner_id, conversation_id,
        listing:listings(name, renter_fee_percent, owner_commission_percent),
        owner:profiles!bookings_owner_id_fkey(username, email),
        renter:profiles!bookings_renter_id_fkey(email, username)
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

    // If webhook already set booking to "active", return success (idempotent)
    if (booking.status === "active") {
      return new Response(
        JSON.stringify({ success: true, booking_id, status: "active" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!PAYABLE_STATUSES.includes(booking.status)) {
      return new Response(
        JSON.stringify({ error: "Cette réservation a déjà été finalisée ou ne peut pas être payée." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // ── Stripe verification: confirm payment actually succeeded ──
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: "Stripe non configuré" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!rental_payment_intent_id) {
      return new Response(
        JSON.stringify({ error: "rental_payment_intent_id requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const rentalPI = await stripeGet(`/payment_intents/${rental_payment_intent_id}`, stripeKey);
    if (rentalPI.error || rentalPI.status !== "succeeded") {
      return new Response(
        JSON.stringify({ error: "Le paiement de la location n'a pas été confirmé par Stripe." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    if (rentalPI.metadata?.booking_id !== booking_id) {
      return new Response(
        JSON.stringify({ error: "Le paiement ne correspond pas à cette réservation." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Deposit is no longer verified here. It will be held later by hold-deposit cron

    const updateData: Record<string, any> = { status: "active" };
    if (rental_payment_intent_id) updateData.stripe_rental_payment_intent_id = rental_payment_intent_id;

    // Atomic: only update if still pending_payment (webhook may have already set active)
    const { error: updateError, count } = await supabaseAdmin
      .from("bookings")
      .update(updateData)
      .eq("id", booking_id)
      .eq("status", "pending_payment");

    if (updateError) {
      return new Response(
        JSON.stringify({ error: "Erreur lors de la mise à jour de la réservation." }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // If count is 0, webhook already handled it. Still success
    if (count === 0) {
      return new Response(
        JSON.stringify({ success: true, booking_id, status: "active" }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const renterFeePercent = ((booking.listing as any)?.renter_fee_percent ?? 7) / 100;
    const ownerCommissionPercent = ((booking.listing as any)?.owner_commission_percent ?? 8) / 100;
    const totalNow = (Math.round(booking.total_price * (1 + renterFeePercent) * 100) / 100).toFixed(2);
    const ownerEarnings = (Math.round(booking.total_price * (1 - ownerCommissionPercent) * 100) / 100).toFixed(2);
    const listingName = (booking.listing as any)?.name ?? "Location";
    const ownerName = (booking.owner as any)?.username ?? "le propriétaire";
    const ownerEmail = (booking.owner as any)?.email ?? null;
    const renterEmail = (booking.renter as any)?.email ?? null;
    const renterName = (booking.renter as any)?.username ?? "un locataire";
    const refId = booking.conversation_id ?? booking_id;
    const startDate = formatDate(booking.start_date);
    const endDate = formatDate(booking.end_date);

    const internalSecret = Deno.env.get("INTERNAL_EDGE_SECRET");

    if (renterEmail) {
      try {
        await supabaseAdmin.functions.invoke("send-email", {
          headers: internalSecret ? { "x-internal-secret": internalSecret } : {},
          body: {
            to: renterEmail,
            template: "booking_paid_renter",
            data: {
              listing_name: listingName,
              owner_name: ownerName,
              start_date: startDate,
              end_date: endDate,
              total_price: totalNow,
              deposit: booking.deposit_amount ?? 0,
              booking_id: refId,
            },
          },
        });
      } catch (emailErr) {
        console.error("Renter email failed:", emailErr);
      }
    }

    if (ownerEmail) {
      try {
        await supabaseAdmin.functions.invoke("send-email", {
          headers: internalSecret ? { "x-internal-secret": internalSecret } : {},
          body: {
            to: ownerEmail,
            template: "booking_paid_owner",
            data: {
              listing_name: listingName,
              renter_name: renterName,
              start_date: startDate,
              end_date: endDate,
              owner_earnings: ownerEarnings,
              booking_id: refId,
            },
          },
        });
      } catch (emailErr) {
        console.error("Owner email failed:", emailErr);
      }
    }

    // For short rentals (end_date within 2 days), trigger deposit hold immediately.
    // Cron runs daily as the safety net. We don't set deposit_hold_failed here,
    // we just surface failures with structured logs so they're visible.
    const twoDaysFromNow = new Date(Date.now() + 2 * 24 * 60 * 60 * 1000);
    if (booking.deposit_amount > 0 && new Date(booking.end_date) <= twoDaysFromNow) {
      try {
        const { data: holdResult, error: holdErr } = await supabaseAdmin.functions.invoke("hold-deposit", {
          headers: internalSecret ? { "x-internal-secret": internalSecret } : {},
          body: { booking_ids: [booking_id], internal_secret: internalSecret },
        });
        if (holdErr) {
          console.error(`Short-rental hold-deposit invoke failed for booking ${booking_id}:`, holdErr);
        } else {
          const result = holdResult?.results?.[0];
          if (result?.status === "failed") {
            console.error(`Short-rental hold-deposit declined for booking ${booking_id}:`, result.reason);
          }
        }
      } catch (holdErr) {
        console.error(`Short-rental hold-deposit trigger threw for booking ${booking_id}:`, holdErr);
      }
    }

    return new Response(
      JSON.stringify({ success: true, booking_id, status: "active" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message ?? "Erreur interne" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
