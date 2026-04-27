import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

// RGPD article 17 "right to erasure" implementation.
//
// Strategy: tombstone pattern.
// - Profile row is KEPT but anonymized (PII cleared, account_status='deleted').
//   This preserves referential integrity for bookings/reviews/messages that
//   point at the user via NO ACTION FKs and that we must keep for
//   accounting (DAC7, French tax retention, dispute history).
// - All PII fields on the profile are nulled.
// - Chat messages content authored by the user is replaced with a tombstone
//   marker so message history stays threaded but says nothing about them.
// - Listings owned by the user are deleted (cascade clears photos refs,
//   listing_views, saved_listings, conversations FK SET NULL, bookings on
//   those listings via CASCADE).
// - Storage buckets cleaned: avatar + listing-photos folder.
// - Stripe Connect account is detached (best-effort).
// - auth.users is deleted via admin API so login is impossible and the
//   email is freed for re-registration.
//
// The function is BLOCKED if the user has rentals in flight (as renter or
// owner) : they must complete or cancel them first. Otherwise money is in
// motion and we'd risk losing track of it.

import { buildCorsHeaders, preflightResponse, type CorsOptions } from "../_shared/cors.ts";

const corsOpts: CorsOptions = { methods: "POST, OPTIONS" };

const BLOCKING_STATUSES = ["active", "in_progress", "pending_return", "pending_owner_validation", "disputed"];

function jsonResponse(corsHeaders: Record<string, string>, payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function deleteStorageFolder(supabase: any, bucket: string, prefix: string): Promise<number> {
  try {
    const { data: list } = await supabase.storage.from(bucket).list(prefix, { limit: 1000 });
    if (!list || list.length === 0) return 0;
    const paths = list.map((f: any) => `${prefix}/${f.name}`);
    await supabase.storage.from(bucket).remove(paths);
    return paths.length;
  } catch (e) {
    console.error(`storage cleanup failed for ${bucket}/${prefix}:`, e instanceof Error ? e.message : e);
    return 0;
  }
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return preflightResponse(req, corsOpts);
  const corsHeaders = buildCorsHeaders(req, corsOpts);
  if (req.method !== "POST") return jsonResponse(corsHeaders, { error: "Method not allowed" }, 405);

  try {
    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const authHeader = req.headers.get("Authorization") ?? "";
    const accessToken = authHeader.replace("Bearer ", "").trim();
    if (!accessToken) return jsonResponse(corsHeaders, { error: "Non authentifié" }, 401);

    const { data: { user }, error: authError } = await supabase.auth.getUser(accessToken);
    if (authError || !user) return jsonResponse(corsHeaders, { error: "Non authentifié" }, 401);

    const userId = user.id;

    // ── 1. Check no in-flight rentals as renter or owner ──
    const { data: activeBookings } = await supabase
      .from("bookings")
      .select("id, status")
      .or(`renter_id.eq.${userId},owner_id.eq.${userId}`)
      .in("status", BLOCKING_STATUSES)
      .limit(1);

    if (activeBookings && activeBookings.length > 0) {
      return jsonResponse(corsHeaders, {
        error: "Tu as une location en cours. Termine ou annule la location avant de supprimer ton compte.",
        blocking_booking_id: activeBookings[0].id,
        status: activeBookings[0].status,
      }, 400);
    }

    // ── 2. Read profile (Stripe account id, etc.) ──
    const { data: profile } = await supabase
      .from("profiles")
      .select("id, stripe_account_id")
      .eq("id", userId)
      .maybeSingle();

    // ── 3. Best-effort Stripe Connect cleanup ──
    if (profile?.stripe_account_id) {
      const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
      if (stripeKey) {
        try {
          await fetch(`https://api.stripe.com/v1/accounts/${profile.stripe_account_id}`, {
            method: "DELETE",
            headers: { "Authorization": `Bearer ${stripeKey}`, "Stripe-Version": "2024-06-20" },
          });
        } catch (e) {
          console.error(`Stripe account delete failed for ${profile.stripe_account_id}:`, e instanceof Error ? e.message : e);
        }
      }
    }

    // ── 4. Storage cleanup (best-effort) ──
    await deleteStorageFolder(supabase, "avatars", userId);
    await deleteStorageFolder(supabase, "listing-photos", userId);

    // ── 5. Anonymize chat message content authored by the user ──
    await supabase
      .from("chat_messages")
      .update({ content: "[Message supprimé]", file_url: null, image_url: null, file_name: null })
      .eq("sender_id", userId);

    // ── 6. Null NO-ACTION FK references on tables we're not deleting ──
    await supabase.from("messages").update({ sender_id: null }).eq("sender_id", userId);
    await supabase.from("reviews").update({ reviewer_id: null }).eq("reviewer_id", userId);
    await supabase.from("reviews").update({ reviewed_id: null }).eq("reviewed_id", userId);

    // ── 7. Delete listings owned by user (cascades photos refs, bookings on
    //   those listings, listing_views, saved_listings).
    await supabase.from("listings").delete().eq("owner_id", userId);

    // ── 8. Delete other user-scoped data we don't keep ──
    await supabase.from("saved_listings").delete().eq("user_id", userId);
    await supabase.from("notifications").delete().eq("user_id", userId);
    await supabase.from("conversations").delete().or(`owner_id.eq.${userId},requester_id.eq.${userId}`);

    // ── 9. Tombstone the profile row ──
    const tombstoneUsername = `deleted_${userId.slice(0, 8)}_${Date.now().toString(36).slice(-4)}`;
    const { error: anonError } = await supabase.from("profiles").update({
      username: tombstoneUsername,
      display_name: null,
      email: null,
      phone_number: null,
      bio: null,
      avatar_url: null,
      photo_url: null,
      location_data: null,
      business_name: null,
      business_address: null,
      siren_number: null,
      stripe_account_id: null,
      stripe_customer_id: null,
      stripe_charges_enabled: false,
      stripe_payouts_enabled: false,
      stripe_onboarding_complete: false,
      stripe_onboarding_notified: false,
      account_status: "deleted",
      onboarding_completed: false,
      is_pro: false,
      role: "user",
      ban_reason: null,
      banned_until: null,
    }).eq("id", userId);

    if (anonError) {
      console.error(`Profile anonymization failed for ${userId}:`, anonError.message);
      return jsonResponse(corsHeaders, { error: "Anonymisation du profil échouée. Contacte le support." }, 500);
    }

    // ── 10. Delete auth.users so login is impossible and email is freed ──
    const { error: authDelError } = await supabase.auth.admin.deleteUser(userId);
    if (authDelError) {
      console.error(`auth.admin.deleteUser failed for ${userId}:`, authDelError.message);
    }

    return jsonResponse(corsHeaders, {
      success: true,
      tombstone_username: tombstoneUsername,
      auth_deleted: !authDelError,
    });
  } catch (err) {
    console.error("delete-user-account error:", err);
    return jsonResponse(corsHeaders, { error: err instanceof Error ? err.message : "Erreur interne" }, 500);
  }
});
