import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

/**
 * Stripe Webhook Handler pour LoueTonBien
 *
 * Événements gérés :
 * - payment_intent.succeeded    → booking "active" + emails confirmation
 * - payment_intent.payment_failed → log l'échec
 * - charge.refunded             → booking "cancelled"
 * - account.updated             → statut Stripe Connect + email activation
 */

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Stripe-Signature",
};

// ── Helper email (non-bloquant) ────────────────────────────────
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

// ── Vérification signature Stripe ─────────────────────────────
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response("Method not allowed", { status: 405, headers: corsHeaders });
  }

  try {
    const webhookSecret = Deno.env.get("STRIPE_WEBHOOK_SECRET");
    const stripeKey     = Deno.env.get("STRIPE_SECRET_KEY");

    if (!webhookSecret || !stripeKey) {
      console.error("Missing STRIPE_WEBHOOK_SECRET or STRIPE_SECRET_KEY");
      return new Response(
        JSON.stringify({ error: "Webhook non configuré" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const body      = await req.text();
    const sigHeader = req.headers.get("stripe-signature") ?? "";

    const isValid = await verifyStripeSignature(body, sigHeader, webhookSecret);
    if (!isValid) {
      console.error("Signature Stripe invalide");
      return new Response(
        JSON.stringify({ error: "Signature invalide" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const event     = JSON.parse(body);
    const eventType = event.type;
    const data      = event.data.object;

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    console.log(`Webhook reçu : ${eventType} · ${data.id}`);

    const fmt = (d: string) =>
      new Date(d).toLocaleDateString("fr-FR", {
        day: "numeric", month: "long", year: "numeric",
      });

    switch (eventType) {

      // ▸ Paiement réussi
      case "payment_intent.succeeded": {
        const bookingId = data.metadata?.booking_id;
        const type      = data.metadata?.type;

        if (!bookingId) {
          console.log("payment_intent.succeeded sans booking_id, ignoré");
          break;
        }

        if (type === "rental") {
          // FIX: le booking est à "pending_payment" quand le paiement est initié,
          // pas "accepted". Le filtre "accepted" ne matchait jamais.
          const { error } = await supabase
            .from("bookings")
            .update({ status: "active", stripe_rental_payment_intent_id: data.id })
            .eq("id", bookingId)
            .eq("status", "pending_payment");

          if (error) {
            console.error(`Erreur update booking ${bookingId}:`, error.message);
            break;
          }

          console.log(`Booking ${bookingId} → active`);

          // ── Récupère booking + profils pour les emails ─────────
          // FIX: display_name supprimé → utilise username
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
          await supabase
            .from("bookings")
            .update({
              stripe_payment_intent_id: data.id,
              deposit_authorized_at: new Date().toISOString(),
              deposit_action: "authorize",
            })
            .eq("id", bookingId);

          console.log(`Booking ${bookingId} · deferred deposit hold confirmed (${data.id})`);
        }

        break;
      }

      // ▸ Paiement échoué
      case "payment_intent.payment_failed": {
        const bookingId      = data.metadata?.booking_id;
        const failureMessage = data.last_payment_error?.message ?? "Raison inconnue";
        console.error(`Paiement échoué pour booking ${bookingId}: ${failureMessage}`);
        break;
      }

      // ▸ Remboursement
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
          break;
        }

        if (!bookings || bookings.length === 0) {
          console.warn(`charge.refunded received for unknown PI ${paymentIntentId}, no booking matched, ignoring`);
          break;
        }

        await supabase
          .from("bookings")
          .update({ status: "cancelled" })
          .eq("id", bookings[0].id);

        console.log(`Booking ${bookings[0].id} → cancelled (remboursement)`);
        break;
      }

      // ▸ Compte Connect mis à jour
      case "account.updated": {
        const accountId      = data.id;
        const chargesEnabled = data.charges_enabled ?? false;
        const payoutsEnabled = data.payouts_enabled ?? false;

        // FIX: display_name supprimé → utilise username
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
          break;
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

    return new Response(JSON.stringify({ received: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    console.error("Erreur webhook:", err.message);
    return new Response(JSON.stringify({ received: true, error: err.message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
