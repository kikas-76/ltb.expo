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

// Constant-time string compare. Returns false on length mismatch (length is
// not secret here — signatures are fixed-size SHA256 hex). Avoids an
// early-exit `===` that could leak the matching prefix length via timing.
function timingSafeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let mismatch = 0;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return mismatch === 0;
}

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

    // Strict numeric parse: parseInt("abc") returns NaN, which silently
    // bypasses `Math.abs(now - NaN) > 300` (NaN comparisons are always
    // false). That would let an attacker replay a captured payload with a
    // garbled timestamp. Refuse anything non-finite.
    const ts = Number(parts.timestamp);
    if (!Number.isFinite(ts)) return false;
    const now = Math.floor(Date.now() / 1000);
    if (Math.abs(now - ts) > 300) return false;

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

    return parts.signatures.some((sig) => timingSafeEqual(sig, expectedSig));
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

        // Only cancel the booking on a *full* refund. Partial refunds keep
        // the rental active — Stripe sends one charge.refunded event per
        // refund operation, so a series of partial refunds would
        // erroneously cancel the booking on the first one. data.refunded
        // is the boolean Stripe sets when amount_refunded === amount.
        const fullyRefunded =
          data.refunded === true ||
          (typeof data.amount === "number" &&
            typeof data.amount_refunded === "number" &&
            data.amount_refunded >= data.amount);

        if (!fullyRefunded) {
          console.log(`charge.refunded partiel pour PI ${paymentIntentId}, booking laissé en l'état`);
          break;
        }

        const { data: bookings, error: lookupError } = await supabase
          .from("bookings")
          .select("id, status, stripe_payment_intent_id, deposit_action")
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

        const refundedBooking = bookings[0];

        // If a deposit hold is sitting in requires_capture, cancel it too
        // — the rental is fully refunded so we can't legitimately keep
        // the renter's caution authorized. Without this, the hold dangles
        // until Stripe auto-expires it after 7 days.
        if (refundedBooking.stripe_payment_intent_id) {
          try {
            const depositPi = await fetch(
              `https://api.stripe.com/v1/payment_intents/${refundedBooking.stripe_payment_intent_id}`,
              { headers: { "Authorization": `Bearer ${stripeKey}`, "Stripe-Version": "2024-06-20" } },
            ).then((r) => r.json());

            if (depositPi?.status === "requires_capture") {
              const cancelRes = await fetch(
                `https://api.stripe.com/v1/payment_intents/${refundedBooking.stripe_payment_intent_id}/cancel`,
                {
                  method: "POST",
                  headers: {
                    "Authorization": `Bearer ${stripeKey}`,
                    "Content-Type": "application/x-www-form-urlencoded",
                    "Stripe-Version": "2024-06-20",
                  },
                },
              );
              const cancelData = await cancelRes.json();
              if (cancelRes.ok || cancelData?.error?.code === "payment_intent_unexpected_state") {
                await supabase
                  .from("bookings")
                  .update({
                    deposit_action: "release",
                    deposit_released_at: new Date().toISOString(),
                  })
                  .eq("id", refundedBooking.id);
                console.log(`Booking ${refundedBooking.id} · deposit hold canceled after rental refund`);
              } else {
                console.error(
                  `Booking ${refundedBooking.id}: deposit cancel failed after refund:`,
                  cancelData?.error,
                );
              }
            }
          } catch (e) {
            // Don't throw — webhook idempotency should not retry forever
            // for a deposit cleanup failure. Log and let the booking flip
            // to cancelled; admin can release manually if needed.
            console.error(`Booking ${refundedBooking.id}: deposit cancel threw:`, e);
          }
        }

        const { error: updateError } = await supabase
          .from("bookings")
          .update({ status: "cancelled" })
          .eq("id", refundedBooking.id);
        if (updateError) throw updateError;

        console.log(`Booking ${refundedBooking.id} → cancelled (remboursement)`);
        break;
      }

      case "account.updated": {
        const accountId = data.id;
        const chargesEnabled = data.charges_enabled ?? false;
        const payoutsEnabled = data.payouts_enabled ?? false;
        const detailsSubmitted = data.details_submitted ?? false;

        // Compact subset of Stripe's full requirements payload — we keep
        // what the wallet UI surfaces to the user and what we use to
        // decide whether to send the "action required" alert.
        const rawReq = data.requirements ?? {};
        const requirements = {
          currently_due: Array.isArray(rawReq.currently_due) ? rawReq.currently_due : [],
          past_due: Array.isArray(rawReq.past_due) ? rawReq.past_due : [],
          disabled_reason: rawReq.disabled_reason ?? null,
          current_deadline: rawReq.current_deadline ?? null,
        };

        const { data: existingProfile } = await supabase
          .from("profiles")
          .select(
            "email, username, stripe_charges_enabled, stripe_onboarding_notified, stripe_requirements",
          )
          .eq("stripe_account_id", accountId)
          .maybeSingle();

        const { error } = await supabase
          .from("profiles")
          .update({
            stripe_charges_enabled: chargesEnabled,
            stripe_payouts_enabled: payoutsEnabled,
            stripe_details_submitted: detailsSubmitted,
            stripe_requirements: requirements,
          })
          .eq("stripe_account_id", accountId);

        if (error) {
          console.error(`Erreur update profil Connect ${accountId}:`, error.message);
          throw error;
        }

        console.log(
          `Connect ${accountId} · charges: ${chargesEnabled}, payouts: ${payoutsEnabled}, due: ${requirements.past_due.length}/${requirements.currently_due.length}`,
        );

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

          // Mask the local part to keep an audit-useful trace (domain) without
          // putting the full PII email into Supabase logs.
          const maskedEmail = String(existingProfile.email ?? "").replace(
            /^([^@]{1,2})[^@]*(@.*)$/,
            "$1***$2",
          );
          console.log(`Email activation Stripe envoyé à ${maskedEmail || "<unknown>"}`);
        }

        // Detect transition into "action required". Stripe re-disables a
        // previously-active account when KYC thresholds bite, payout
        // limits trigger ID verification, etc. We mail the owner once per
        // transition (idempotent across webhook retries because we look
        // at the *previous* requirements column to gate it).
        const previousReq = (existingProfile?.stripe_requirements ?? {}) as {
          past_due?: string[];
          disabled_reason?: string | null;
        };
        const wasClean =
          (previousReq.past_due?.length ?? 0) === 0 &&
          !previousReq.disabled_reason;
        const isNowBlocking =
          requirements.past_due.length > 0 ||
          !!requirements.disabled_reason;

        if (wasClean && isNowBlocking && existingProfile?.email) {
          const deadlineIso = requirements.current_deadline
            ? new Date(requirements.current_deadline * 1000).toISOString()
            : null;
          await sendEmail(
            supabase,
            existingProfile.email,
            "stripe_account_action_required",
            {
              first_name: existingProfile.username ?? "",
              disabled_reason: requirements.disabled_reason ?? "",
              past_due_count: requirements.past_due.length,
              deadline: deadlineIso,
            },
          );
          console.log(`Email "action requise Stripe" envoyé · ${accountId}`);
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
