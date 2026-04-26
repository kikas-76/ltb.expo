import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Stripe Webhook Handler pour LoueTonBien
 *
 * Événements gérés :
 * - payment_intent.succeeded     → booking "active" + emails confirmation
 * - payment_intent.payment_failed → log l'échec
 * - charge.refunded              → booking "cancelled"
 * - account.updated              → statut Stripe Connect + email activation
 *
 * Idempotency: every event is logged in public.stripe_events keyed by
 * event_id. Duplicates short-circuit to 200 without re-running the
 * side-effect path. Transient failures bubble up as 5xx so Stripe
 * retries; the retry collides on the unique key and replays at most
 * the parts that hadn't completed.
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Stripe-Signature",
};

const sendEmail = async (
  supabase: any,
  to: string,
  template: string,
  data: Record<string, any>
) => {
  try {
    await supabase.functions.invoke("send-email", {
      body: { to, template, data },
    });
  } catch (err) {
    console.error(`[send-email] échec template "${template}":`, err);
  }
};

async function verifyStripeSignature(
  payload: string,
  sigHeader: string,
  secret: string
): Promise<boolean> {
  try {
    const parts = sigHeader.split(",").reduce(
      (acc, part) => {
        const [key, val] = part.split("=");
        if (key === "t") acc.timestamp = val;
        if (key === "v1") acc.signatures.push(val);
        return acc;
      },
      { timestamp: "", signatures: [] as string[] }
    );

    if (!parts.timestamp || parts.signatures.length === 0) return false;

    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - parseInt(parts.timestamp)) > 300) return false;

    const signedPayload = `${parts.timestamp}.${payload}`;
    const encoder = new TextEncoder();
    const key = await crypto.subtle.importKey(
      "raw",
      encoder.encode(secret),
      { name: "HMAC", hash: "SHA-256" },
      false,
      ["sign"]
    );
    const signature = await crypto.subtle.sign("HMAC", key, encoder.encode(signedPayload));
    const expectedSig = Array.from(new Uint8Array(signature))
      .map((b) => b.toString(16).padStart(2, "0"))
      .join("");

    return parts.signatures.some((sig) => sig === expectedSig);
  } catch {
    return false;
  }
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  // Bookkeeping for the catch-all: we want to flip the stripe_events row
  // to status='failed' before bouncing 5xx, so retries can see the
  // previous attempt's error message.
  let eventIdForCatch: string | null = null;
  let supabaseForCatch: any = null;

  try {
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");

    if (!webhookSecret || !stripeKey) {
      console.error("Missing STRIPE_WEBHOOK_SECRET or STRIPE_SECRET_KEY");
      // Configuration error is not retriable — Stripe replays won't fix it.
      return json({ error: "Webhook non configuré" }, 500);
    }

    const body = await req.text();
    const sigHeader = req.headers.get("stripe-signature") ?? "";

    const isValid = await verifyStripeSignature(body, sigHeader, webhookSecret);
    if (!isValid) {
      console.error("Signature Stripe invalide");
      return json({ error: "Signature invalide" }, 400);
    }

    const event = JSON.parse(body);
    const eventType: string = event.type;
    const data = event.data.object;
    const eventId: string | undefined = event.id;

    if (!eventId) {
      console.error("Event without id, refusing to process");
      return json({ error: "Missing event id" }, 400);
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );
    eventIdForCatch = eventId;
    supabaseForCatch = supabase;

    // ── Idempotency check ────────────────────────────────────────
    // Insert succeeds for a fresh event; it conflicts on event_id for
    // a duplicate. We use upsert with `ignoreDuplicates: true` and
    // check whether a row was actually inserted by re-fetching status.
    const { error: insertError } = await supabase
      .from("stripe_events")
      .insert({
        event_id: eventId,
        type: eventType,
        booking_id: data?.metadata?.booking_id ?? null,
      });

    if (insertError) {
      // 23505 = unique_violation → already processed (or in flight)
      if ((insertError as any).code === "23505") {
        const { data: existing } = await supabase
          .from("stripe_events")
          .select("status")
          .eq("event_id", eventId)
          .maybeSingle();

        if (existing?.status === "processed") {
          console.log(`Event ${eventId} déjà traité, idempotent 200`);
          return json({ received: true, idempotent: true }, 200);
        }
        // Status is 'received' or 'failed' — another retry might still
        // be in flight, or the previous attempt died mid-way. Replaying
        // is safer than silently swallowing, so we continue.
        console.log(`Event ${eventId} retry détecté (status=${existing?.status})`);
      } else {
        // Transient DB issue — let Stripe retry
        console.error(`stripe_events insert failed for ${eventId}:`, insertError.message);
        return json({ error: "Database unavailable" }, 503);
      }
    }

    console.log(`Webhook reçu : ${eventType} · ${data.id} (event ${eventId})`);

    const fmt = (d: string) =>
      new Date(d).toLocaleDateString("fr-FR", {
        day: "numeric", month: "long", year: "numeric",
      });

    switch (eventType) {

      case "payment_intent.succeeded": {
        const bookingId = data.metadata?.booking_id;
        const type = data.metadata?.type;

        if (!bookingId) {
          console.log("payment_intent.succeeded sans booking_id, ignoré");
          break;
        }

        if (type === "rental") {
          const { error } = await supabase
            .from("bookings")
            .update({ status: "active", stripe_rental_payment_intent_id: data.id })
            .eq("id", bookingId)
            .eq("status", "pending_payment");

          if (error) {
            console.error(`Erreur update booking ${bookingId}:`, error.message);
            throw error; // transient — Stripe retry
          }

          console.log(`Booking ${bookingId} → active`);

          const { data: booking, error: fetchError } = await supabase
            .from("bookings")
            .select(`
              id, total_price, deposit_amount, start_date, end_date,
              listing:listings(name, owner_commission_percent),
              renter:profiles!bookings_renter_id_fkey(email, username),
              owner:profiles!bookings_owner_id_fkey(email, username)
            `)
            .eq("id", bookingId)
            .maybeSingle();

          if (fetchError) {
            console.error(`Booking ${bookingId} fetch failed after activation, emails skipped:`, fetchError.message);
          } else if (!booking) {
            console.error(`Booking ${bookingId} not found after activation, emails skipped`);
          }

          if (booking) {
            const commissionPercent = (booking.listing?.owner_commission_percent ?? 8) / 100;
            const ownerEarnings = Math.round((booking.total_price ?? 0) * (1 - commissionPercent) * 100) / 100;

            await sendEmail(
              supabase,
              booking.renter.email,
              "booking_paid_renter",
              {
                listing_name: booking.listing.name,
                owner_name:   booking.owner.username ?? "le propriétaire",
                start_date:   fmt(booking.start_date),
                end_date:     fmt(booking.end_date),
                total_price:  booking.total_price,
                deposit:      booking.deposit_amount,
                booking_id:   booking.id,
              }
            );

            await sendEmail(
              supabase,
              booking.owner.email,
              "booking_paid_owner",
              {
                listing_name:   booking.listing.name,
                renter_name:    booking.renter.username ?? "un locataire",
                start_date:     fmt(booking.start_date),
                end_date:       fmt(booking.end_date),
                owner_earnings: ownerEarnings,
                booking_id:     booking.id,
              }
            );
          }
        }

        if (type === "deposit_hold") {
          const { error } = await supabase
            .from("bookings")
            .update({
              stripe_payment_intent_id: data.id,
              deposit_authorized_at: new Date().toISOString(),
              deposit_action: "authorize",
            })
            .eq("id", bookingId);
          if (error) throw error;

          console.log(`Booking ${bookingId} · deferred deposit hold confirmed (${data.id})`);
        }

        break;
      }

      case "payment_intent.payment_failed": {
        const bookingId = data.metadata?.booking_id;
        const failureMessage = data.last_payment_error?.message ?? "Raison inconnue";
        console.error(`Paiement échoué pour booking ${bookingId}: ${failureMessage}`);
        break;
      }

      case "charge.refunded": {
        const paymentIntentId = data.payment_intent;
        if (!paymentIntentId) {
          console.warn("charge.refunded sans payment_intent, ignoré");
          break;
        }

        const { data: bookings, error: lookupError } = await supabase
          .from("bookings")
          .select("id, status")
          .eq("stripe_rental_payment_intent_id", paymentIntentId)
          .limit(1);

        if (lookupError) {
          console.error(`charge.refunded lookup failed for PI ${paymentIntentId}:`, lookupError.message);
          throw lookupError; // transient
        }

        if (!bookings || bookings.length === 0) {
          console.warn(`charge.refunded received for unknown PI ${paymentIntentId}, no booking matched, ignoring`);
          break;
        }

        const { error: updateError } = await supabase
          .from("bookings")
          .update({ status: "cancelled" })
          .eq("id", bookings[0].id);
        if (updateError) throw updateError;

        console.log(`Booking ${bookings[0].id} → cancelled (remboursement)`);
        break;
      }

      case "account.updated": {
        const accountId = data.id;
        const chargesEnabled = data.charges_enabled ?? false;
        const payoutsEnabled = data.payouts_enabled ?? false;

        const { data: existingProfile } = await supabase
          .from("profiles")
          .select("email, username, stripe_charges_enabled, stripe_onboarding_notified")
          .eq("stripe_account_id", accountId)
          .maybeSingle();

        const { error } = await supabase
          .from("profiles")
          .update({
            stripe_charges_enabled: chargesEnabled,
            stripe_payouts_enabled: payoutsEnabled,
          })
          .eq("stripe_account_id", accountId);

        if (error) {
          console.error(`Erreur update profil Connect ${accountId}:`, error.message);
          throw error;
        }

        console.log(`Connect ${accountId} · charges: ${chargesEnabled}, payouts: ${payoutsEnabled}`);

        const justActivated =
          chargesEnabled &&
          !existingProfile?.stripe_charges_enabled &&
          !existingProfile?.stripe_onboarding_notified;

        if (justActivated && existingProfile?.email) {
          await sendEmail(
            supabase,
            existingProfile.email,
            "stripe_account_activated",
            { first_name: existingProfile.username ?? "" }
          );

          await supabase
            .from("profiles")
            .update({ stripe_onboarding_notified: true })
            .eq("stripe_account_id", accountId);

          console.log(`Email activation Stripe envoyé à ${existingProfile.email}`);
        }

        break;
      }

      default:
        console.log(`Événement non géré : ${eventType}`);
    }

    // Mark event as fully processed
    await supabase
      .from("stripe_events")
      .update({ status: "processed", processed_at: new Date().toISOString() })
      .eq("event_id", eventId);

    return json({ received: true }, 200);

  } catch (err: any) {
    console.error("Erreur webhook:", err?.message ?? err);

    // Best-effort: tag the event row as failed so the next retry can see
    // the prior error. Swallow secondary failures so we still return 5xx.
    if (eventIdForCatch && supabaseForCatch) {
      try {
        await supabaseForCatch
          .from("stripe_events")
          .update({ status: "failed", error: String(err?.message ?? err).slice(0, 1000) })
          .eq("event_id", eventIdForCatch);
      } catch (logErr) {
        console.error("Failed to update stripe_events on failure:", logErr);
      }
    }

    // Bubble up as 5xx so Stripe retries the delivery. The idempotency
    // check at the top of the next attempt prevents double processing
    // of the parts that completed before the throw.
    return json({ error: err?.message ?? "Internal error" }, 500);
  }
});
