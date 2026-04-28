import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, preflightResponse, type CorsOptions } from "../_shared/cors.ts";
import { getAccessToken, isInternalCall as sharedIsInternalCall } from "../_shared/auth.ts";

const corsOpts: CorsOptions = { methods: "POST, OPTIONS" };

function jsonResponse(corsHeaders: Record<string, string>, payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function isInternalCall(req: Request, body: Record<string, any>): boolean {
  const expected = Deno.env.get("INTERNAL_EDGE_SECRET");
  if (!expected) return false;
  return sharedIsInternalCall(req, body, expected);
}

function getPersonName(profile: any, fallback: string): string {
  return profile?.username || fallback;
}

async function stripeGet(path: string, key: string) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "GET",
    headers: {
      Authorization: `Bearer ${key}`,
      "Stripe-Version": "2024-06-20",
    },
  });
  return res.json();
}

async function stripePost(path: string, body: URLSearchParams, key: string) {
  const res = await fetch(`https://api.stripe.com/v1${path}`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/x-www-form-urlencoded",
      "Stripe-Version": "2024-06-20",
    },
    body: body.toString(),
  });
  return res.json();
}

async function sendEmailSafe(
  supabaseAdmin: any,
  to: string | null | undefined,
  template: string,
  data: Record<string, any>
) {
  if (!to) return;
  try {
    await supabaseAdmin.functions.invoke("send-email", {
      body: { to, template, data },
    });
  } catch (err) {
    console.error(`[send-email] échec sur ${template}:`, err);
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req, corsOpts);
  }
  const corsHeaders = buildCorsHeaders(req, corsOpts);

  if (req.method !== "POST") {
    return jsonResponse(corsHeaders, { error: "Méthode non autorisée" }, 405);
  }

  try {
    const body = await req.json();
    const bookingId = String(body?.booking_id ?? "").trim();
    const action = String(body?.action ?? "").trim();

    const internal = isInternalCall(req, body);
    const accessToken = getAccessToken(req, body);

    if (!bookingId || !action) {
      return jsonResponse(corsHeaders, { error: "booking_id et action requis" }, 400);
    }

    if (!["release", "capture"].includes(action)) {
      return jsonResponse(corsHeaders, 
        { error: "action doit être 'release' ou 'capture'" },
        400
      );
    }

    if (!internal && !accessToken) {
      return jsonResponse(corsHeaders, { error: "Non authentifié" }, 401);
    }

    const supabaseAdmin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    let user: any = null;

    if (!internal && accessToken) {
      const { data, error } = await supabaseAdmin.auth.getUser(accessToken);
      if (error || !data?.user) {
        return jsonResponse(corsHeaders, { error: "Non authentifié" }, 401);
      }
      user = data.user;
    }

    const { data: booking, error: bookingError } = await supabaseAdmin
      .from("bookings")
      .select(`
        id,
        owner_id,
        renter_id,
        status,
        total_price,
        deposit_amount,
        stripe_payment_intent_id,
        deposit_action,
        deposit_authorized_at,
        deposit_released_at,
        deposit_captured_at,
        start_date,
        end_date,
        listing:listings(name, owner_commission_percent),
        renter:profiles!bookings_renter_id_fkey(email, username),
        owner:profiles!bookings_owner_id_fkey(email, username)
      `)
      .eq("id", bookingId)
      .maybeSingle();

    if (bookingError || !booking) {
      return jsonResponse(corsHeaders, { error: "Réservation introuvable" }, 404);
    }

    const renterName = getPersonName(booking.renter, "le locataire");
    const ownerName = getPersonName(booking.owner, "le propriétaire");
    const listingName = booking.listing?.name ?? "Location";

    const depositAmount = Number(booking.deposit_amount ?? 0);
    // Source of truth = DB. Never trust a client-supplied PI id: an owner
    // could pass another booking's PI and trigger a cancel on it.
    const depositPiId = booking.stripe_payment_intent_id || null;

    // RELEASE = owner or internal only
    if (action === "release") {
      if (!internal) {
        if (!user || booking.owner_id !== user.id) {
          return jsonResponse(corsHeaders, 
            { error: "Seul le propriétaire ou le backend interne peut libérer la caution" },
            403
          );
        }
      }

      // FIX: added "disputed". Admins must be able to release deposit even when disputed
      // "pending_owner_validation" is now valid since CHECK constraint was corrected
      const allowedStatuses = [
        "pending_owner_validation",
        "completed",
        "active",
        "disputed",
      ];

      if (!allowedStatuses.includes(String(booking.status ?? ""))) {
        return jsonResponse(corsHeaders, 
          { error: `Impossible de libérer la caution pour le statut '${booking.status}'` },
          400
        );
      }

      if (depositAmount <= 0) {
        return jsonResponse(corsHeaders, {
          success: true,
          message: "Aucune caution à libérer.",
          deposit_action: "no_deposit",
        });
      }

      if (!depositPiId) {
        // No Stripe PI exists (hold not yet created or hold failed). Graceful release
        await supabaseAdmin.from("bookings").update({
          deposit_action: "release",
          deposit_released_at: new Date().toISOString(),
        }).eq("id", bookingId);
        return jsonResponse(corsHeaders, {
          success: true,
          message: "Aucune caution Stripe active, marquée comme libérée.",
          deposit_action: "release",
        });
      }

      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeKey) {
        return jsonResponse(corsHeaders, { error: "Stripe non configuré" }, 500);
      }

      const existingIntent = await stripeGet(`/payment_intents/${depositPiId}`, stripeKey);

      if (existingIntent?.error) {
        return jsonResponse(corsHeaders, { error: existingIntent.error.message }, 400);
      }

      // Defense in depth: even though depositPiId comes from the DB row of
      // this booking, double-check Stripe metadata before any cancel/capture.
      if (existingIntent?.metadata?.booking_id !== bookingId) {
        console.error(
          `manage-deposit release: metadata mismatch booking=${bookingId} pi=${depositPiId} pi_meta=${existingIntent?.metadata?.booking_id}`,
        );
        return jsonResponse(corsHeaders, { error: "Caution Stripe incohérente avec la réservation." }, 400);
      }

      const stripeStatus = String(existingIntent?.status ?? "");

      if (stripeStatus === "canceled") {
        await supabaseAdmin
          .from("bookings")
          .update({
            deposit_action: "release",
            deposit_released_at: booking.deposit_released_at ?? new Date().toISOString(),
          })
          .eq("id", bookingId);

        return jsonResponse(corsHeaders, {
          success: true,
          message: "La caution était déjà libérée.",
          deposit_action: "release",
          stripe_status: stripeStatus,
        });
      }

      if (stripeStatus === "succeeded") {
        return jsonResponse(corsHeaders, 
          { error: "La caution a déjà été capturée, elle ne peut plus être libérée." },
          400
        );
      }

      if (stripeStatus !== "requires_capture") {
        return jsonResponse(corsHeaders, 
          { error: `La caution n'est pas dans un état libérable (${stripeStatus}).` },
          400
        );
      }

      const cancelResult = await stripePost(
        `/payment_intents/${depositPiId}/cancel`,
        new URLSearchParams(),
        stripeKey
      );

      if (cancelResult?.error) {
        return jsonResponse(corsHeaders, { error: cancelResult.error.message }, 400);
      }

      await supabaseAdmin
        .from("bookings")
        .update({
          deposit_action: "release",
          deposit_released_at: new Date().toISOString(),
        })
        .eq("id", bookingId);

      await sendEmailSafe(supabaseAdmin, booking.renter?.email, "deposit_released", {
        listing_name: listingName,
        deposit: depositAmount,
      });

      await sendEmailSafe(supabaseAdmin, booking.owner?.email, "payout_sent", {
        listing_name: listingName,
        renter_name: renterName,
        amount: Math.round((Number(booking.total_price ?? 0) * (1 - (booking.listing?.owner_commission_percent ?? 8) / 100)) * 100) / 100,
      });

      return jsonResponse(corsHeaders, {
        success: true,
        message: "Caution libérée avec succès.",
        deposit_action: "release",
        stripe_status: cancelResult.status,
      });
    }

    // CAPTURE = internal only
    if (action === "capture") {
      if (!internal) {
        return jsonResponse(corsHeaders, 
          { error: "La capture de caution est réservée au backend interne/admin." },
          403
        );
      }

      if (depositAmount <= 0) {
        return jsonResponse(corsHeaders, 
          { error: "Aucune caution à capturer pour cette réservation." },
          400
        );
      }

      if (!depositPiId) {
        return jsonResponse(corsHeaders, 
          { error: "Aucune caution Stripe associée à cette réservation" },
          400
        );
      }

      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (!stripeKey) {
        return jsonResponse(corsHeaders, { error: "Stripe non configuré" }, 500);
      }

      const existingIntent = await stripeGet(`/payment_intents/${depositPiId}`, stripeKey);

      if (existingIntent?.error) {
        return jsonResponse(corsHeaders, { error: existingIntent.error.message }, 400);
      }

      if (existingIntent?.metadata?.booking_id !== bookingId) {
        console.error(
          `manage-deposit capture: metadata mismatch booking=${bookingId} pi=${depositPiId} pi_meta=${existingIntent?.metadata?.booking_id}`,
        );
        return jsonResponse(corsHeaders, { error: "Caution Stripe incohérente avec la réservation." }, 400);
      }

      const stripeStatus = String(existingIntent?.status ?? "");

      if (stripeStatus === "succeeded") {
        await supabaseAdmin
          .from("bookings")
          .update({
            deposit_action: "capture",
            deposit_captured_at: booking.deposit_captured_at ?? new Date().toISOString(),
          })
          .eq("id", bookingId);

        return jsonResponse(corsHeaders, {
          success: true,
          message: "La caution avait déjà été capturée.",
          deposit_action: "capture",
          stripe_status: stripeStatus,
        });
      }

      if (stripeStatus === "canceled") {
        return jsonResponse(corsHeaders, 
          { error: "La caution est déjà annulée/libérée, elle ne peut plus être capturée." },
          400
        );
      }

      if (stripeStatus !== "requires_capture") {
        return jsonResponse(corsHeaders, 
          { error: `La caution n'est pas dans un état capturable (${stripeStatus}).` },
          400
        );
      }

      const captureResult = await stripePost(
        `/payment_intents/${depositPiId}/capture`,
        new URLSearchParams(),
        stripeKey
      );

      if (captureResult?.error) {
        return jsonResponse(corsHeaders, { error: captureResult.error.message }, 400);
      }

      await supabaseAdmin
        .from("bookings")
        .update({
          deposit_action: "capture",
          deposit_captured_at: new Date().toISOString(),
        })
        .eq("id", bookingId);

      await sendEmailSafe(supabaseAdmin, booking.owner?.email, "dispute_resolved_owner_won", {
        listing_name: listingName,
        deposit: depositAmount,
      });

      await sendEmailSafe(supabaseAdmin, booking.renter?.email, "dispute_resolved_renter_lost", {
        listing_name: listingName,
        deposit: depositAmount,
      });

      return jsonResponse(corsHeaders, {
        success: true,
        message: `Caution de ${depositAmount} € capturée avec succès.`,
        deposit_action: "capture",
        stripe_status: captureResult.status,
      });
    }

    return jsonResponse(corsHeaders, { error: "Action non gérée" }, 400);
  } catch (err: any) {
    console.error("manage-deposit error:", err);
    return jsonResponse(corsHeaders, { error: err.message ?? "Erreur interne" }, 500);
  }
});
