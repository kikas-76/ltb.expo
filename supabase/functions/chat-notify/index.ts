import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, preflightResponse, type CorsOptions } from "../_shared/cors.ts";

const corsOpts: CorsOptions = {
  methods: "POST, OPTIONS",
};

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req, corsOpts);
  }
  const corsHeaders = buildCorsHeaders(req, corsOpts);

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

    const body = await req.json();
    const { event, conversation_id, booking_id } = body;

    if (!event) {
      return new Response(
        JSON.stringify({ error: "event requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const INTERNAL_EDGE_SECRET = Deno.env.get("INTERNAL_EDGE_SECRET") ?? "";

    async function dispatchEmail(to: string, template: string, data: Record<string, any>) {
      // Direct fetch with explicit headers. supabase-js's
      // `.functions.invoke()` in the Deno runtime doesn't reliably
      // attach `Authorization: Bearer <service_role_key>`, which sends
      // verify_jwt-protected functions like send-email back a 401 before
      // they ever reach our `getAuthorized()` gate. send-email accepts
      // either the service-role key OR INTERNAL_EDGE_SECRET — we send
      // both so the call works regardless of the runtime config.
      try {
        const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
            "apikey": SERVICE_ROLE_KEY,
            "x-internal-secret": INTERNAL_EDGE_SECRET,
          },
          body: JSON.stringify({ to, template, data }),
        });
        if (!res.ok) {
          const body = await res.text().catch(() => "");
          console.error(`send-email ${template} → ${res.status}: ${body.slice(0, 200)}`);
        }
      } catch (err) {
        console.error(`Email dispatch failed (${template}):`, err);
      }
    }

    if (event === "booking_accepted" || event === "booking_rejected") {
      if (!conversation_id) {
        return new Response(
          JSON.stringify({ error: "conversation_id requis" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: conv } = await supabaseAdmin
        .from("conversations")
        .select(`
          id, owner_id, requester_id,
          listing:listings(name),
          owner:profiles!conversations_owner_id_fkey(username),
          requester:profiles!conversations_requester_id_fkey(email)
        `)
        .eq("id", conversation_id)
        .maybeSingle();

      if (!conv) {
        return new Response(
          JSON.stringify({ error: "Conversation introuvable" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if ((conv as any).owner_id !== user.id) {
        return new Response(
          JSON.stringify({ error: "Accès refusé : seul le propriétaire peut déclencher cet événement" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const renterEmail = (conv.requester as any)?.email ?? null;
      if (!renterEmail) {
        return new Response(
          JSON.stringify({ success: true, event, skipped: "no renter email" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const ownerName = (conv.owner as any)?.username ?? "le propriétaire";
      const listingName = (conv.listing as any)?.name ?? "Location";

      if (event === "booking_accepted") {
        const { data: bookingRow } = await supabaseAdmin
          .from("bookings")
          .select("id, total_price, deposit_amount, start_date, end_date, conversation_id")
          .eq("conversation_id", conversation_id)
          .maybeSingle();

        await dispatchEmail(renterEmail, "booking_accepted_renter", {
          listing_name: listingName,
          owner_name: ownerName,
          start_date: bookingRow?.start_date ? formatDate(bookingRow.start_date) : "",
          end_date: bookingRow?.end_date ? formatDate(bookingRow.end_date) : "",
          total_price: bookingRow?.total_price ?? 0,
          deposit: bookingRow?.deposit_amount ?? 0,
          booking_id: bookingRow?.id ?? "",
        });
      } else {
        await dispatchEmail(renterEmail, "booking_rejected_renter", {
          listing_name: listingName,
          owner_name: ownerName,
        });
      }

      return new Response(
        JSON.stringify({ success: true, event }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (event === "booking_request") {
      // Fired right after a renter creates a conversation on a listing.
      // Sends two emails: notification to the owner, confirmation to
      // the renter. Caller must be the requester (defence in depth on
      // top of the auth.uid() check the conversation's RLS already does
      // when the row was inserted).
      if (!conversation_id) {
        return new Response(
          JSON.stringify({ error: "conversation_id requis" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: conv } = await supabaseAdmin
        .from("conversations")
        .select(`
          id, owner_id, requester_id, start_date, end_date, listing_id,
          listing:listings(name, price, deposit_amount, renter_fee_percent, owner_commission_percent),
          owner:profiles!conversations_owner_id_fkey(username, email),
          requester:profiles!conversations_requester_id_fkey(username, email)
        `)
        .eq("id", conversation_id)
        .maybeSingle();

      if (!conv) {
        return new Response(
          JSON.stringify({ error: "Conversation introuvable" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if ((conv as any).requester_id !== user.id) {
        return new Response(
          JSON.stringify({ error: "Accès refusé : seul le locataire peut déclencher cet événement" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const listing = (conv as any).listing ?? {};
      const owner = (conv as any).owner ?? {};
      const requester = (conv as any).requester ?? {};

      // Mirror the pricing logic in lib/pricing.ts and the
      // create_booking_for_payment RPC so the email shows the same
      // numbers the rest of the app does.
      const startMs = new Date((conv as any).start_date).getTime();
      const endMs = new Date((conv as any).end_date).getTime();
      const days = Math.max(1, Math.round((endMs - startMs) / (1000 * 60 * 60 * 24)));
      const discount = days >= 7 ? 0.20 : days >= 3 ? 0.10 : 0;
      const price = Number(listing.price ?? 0);
      const rental = Math.round(price * days * (1 - discount));
      const renterFeePct = Number(listing.renter_fee_percent ?? 7);
      const ownerCommissionPct = Number(listing.owner_commission_percent ?? 8);
      const renterFee = Math.round(rental * renterFeePct / 100);
      const ownerCommission = Math.round(rental * ownerCommissionPct / 100);
      const ownerEarnings = rental - ownerCommission;
      const totalRenterPays = rental + renterFee;
      const deposit = Number(listing.deposit_amount ?? 0);

      const renterMessage = typeof body?.message === "string" ? body.message.trim() : "";

      if (owner.email) {
        await dispatchEmail(owner.email, "booking_request_owner", {
          renter_name: requester.username ?? "Un locataire",
          listing_name: listing.name ?? "Objet",
          start_date: formatDate((conv as any).start_date),
          end_date: formatDate((conv as any).end_date),
          duration: days,
          owner_earnings: ownerEarnings,
          deposit,
          renter_message: renterMessage,
          conversation_id: conv.id,
        });
      }

      if (requester.email) {
        await dispatchEmail(requester.email, "booking_request_renter", {
          listing_name: listing.name ?? "Objet",
          start_date: formatDate((conv as any).start_date),
          end_date: formatDate((conv as any).end_date),
          total_price: totalRenterPays,
          deposit,
          owner_name: owner.username ?? "Le propriétaire",
          conversation_id: conv.id,
        });
      }

      return new Response(
        JSON.stringify({ success: true, event }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (event === "deposit_released") {
      if (!booking_id) {
        return new Response(
          JSON.stringify({ error: "booking_id requis" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: bookingRow } = await supabaseAdmin
        .from("bookings")
        .select(`
          owner_id, renter_id, deposit_amount,
          listing:listings(name),
          owner:profiles!bookings_owner_id_fkey(username)
        `)
        .eq("id", booking_id)
        .maybeSingle();

      if (!bookingRow) {
        return new Response(
          JSON.stringify({ error: "Réservation introuvable" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if ((bookingRow as any).owner_id !== user.id) {
        return new Response(
          JSON.stringify({ error: "Accès refusé : seul le propriétaire peut libérer la caution" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: renterProfile } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("id", (bookingRow as any).renter_id)
        .maybeSingle();

      if (renterProfile?.email) {
        await dispatchEmail(renterProfile.email, "deposit_released", {
          listing_name: (bookingRow.listing as any)?.name ?? "Location",
          deposit: (bookingRow as any).deposit_amount ?? 0,
          owner_name: (bookingRow.owner as any)?.username ?? "le propriétaire",
        });
      }

      return new Response(
        JSON.stringify({ success: true, event }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (event === "dispute_opened") {
      if (!booking_id) {
        return new Response(
          JSON.stringify({ error: "booking_id requis" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: bookingRow } = await supabaseAdmin
        .from("bookings")
        .select("owner_id, renter_id, deposit_amount, start_date, end_date, listing:listings(name)")
        .eq("id", booking_id)
        .maybeSingle();

      if (!bookingRow) {
        return new Response(
          JSON.stringify({ error: "Réservation introuvable" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if ((bookingRow as any).owner_id !== user.id && (bookingRow as any).renter_id !== user.id) {
        return new Response(
          JSON.stringify({ error: "Accès refusé : vous n'êtes pas impliqué dans cette réservation" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: disputeRow } = await supabaseAdmin
        .from("disputes")
        .select("id")
        .eq("booking_id", booking_id)
        .maybeSingle();

      if (!disputeRow) {
        return new Response(
          JSON.stringify({ error: "Aucun litige trouvé pour cette réservation" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const emailData = {
        listing_name: (bookingRow.listing as any)?.name ?? "Location",
        start_date: formatDate((bookingRow as any).start_date),
        end_date: formatDate((bookingRow as any).end_date),
        deposit: (bookingRow as any).deposit_amount ?? 0,
        dispute_id: disputeRow.id,
      };

      const { data: renterP } = await supabaseAdmin
        .from("profiles").select("email").eq("id", (bookingRow as any).renter_id).maybeSingle();
      const { data: ownerP } = await supabaseAdmin
        .from("profiles").select("email").eq("id", (bookingRow as any).owner_id).maybeSingle();

      if (renterP?.email) await dispatchEmail(renterP.email, "dispute_opened", emailData);
      if (ownerP?.email) await dispatchEmail(ownerP.email, "dispute_opened", emailData);

      return new Response(
        JSON.stringify({ success: true, event }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (event === "booking_completed") {
      // Sent when a booking transitions to `completed`. Caller must be
      // a participant. Targets BOTH renter and owner with a short
      // "location finalisée" + soft CTA to rate.
      if (!booking_id) {
        return new Response(
          JSON.stringify({ error: "booking_id requis" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: bookingRow } = await supabaseAdmin
        .from("bookings")
        .select(`
          id, owner_id, renter_id, deposit_released_at,
          listing:listings(name),
          renter:profiles!bookings_renter_id_fkey(email),
          owner:profiles!bookings_owner_id_fkey(email)
        `)
        .eq("id", booking_id)
        .maybeSingle();

      if (!bookingRow) {
        return new Response(
          JSON.stringify({ error: "Réservation introuvable" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      if ((bookingRow as any).owner_id !== user.id && (bookingRow as any).renter_id !== user.id) {
        return new Response(
          JSON.stringify({ error: "Accès refusé : vous n'êtes pas impliqué dans cette réservation" }),
          { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const data = {
        listing_name: (bookingRow.listing as any)?.name ?? "ta location",
        booking_id,
        deposit_released: !!(bookingRow as any).deposit_released_at,
      };

      const renterEmail = (bookingRow.renter as any)?.email;
      const ownerEmail = (bookingRow.owner as any)?.email;
      if (renterEmail) await dispatchEmail(renterEmail, "booking_completed", data);
      if (ownerEmail) await dispatchEmail(ownerEmail, "booking_completed", data);

      return new Response(
        JSON.stringify({ success: true, event }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (event === "review_received") {
      // Fired right after a reviewer submits a review. Caller must
      // be the reviewer. Targets the reviewed user.
      if (!booking_id) {
        return new Response(
          JSON.stringify({ error: "booking_id requis" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: reviewRow } = await supabaseAdmin
        .from("reviews")
        .select(`
          rating, comment, reviewer_id, reviewed_id,
          listing:listings(name),
          reviewer:profiles!reviews_reviewer_id_fkey(username),
          reviewed:profiles!reviews_reviewed_id_fkey(email)
        `)
        .eq("booking_id", booking_id)
        .eq("reviewer_id", user.id)
        .maybeSingle();

      if (!reviewRow) {
        return new Response(
          JSON.stringify({ error: "Avis introuvable ou tu n'es pas son auteur" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const reviewedEmail = (reviewRow.reviewed as any)?.email;
      if (reviewedEmail) {
        await dispatchEmail(reviewedEmail, "review_received", {
          rating: (reviewRow as any).rating,
          comment: (reviewRow as any).comment,
          reviewer_name: (reviewRow.reviewer as any)?.username ?? "Un utilisateur",
          listing_name: (reviewRow.listing as any)?.name ?? "ton objet",
          reviewed_id: (reviewRow as any).reviewed_id,
        });
      }

      return new Response(
        JSON.stringify({ success: true, event }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ error: `Événement inconnu: ${event}` }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message ?? "Erreur interne" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
