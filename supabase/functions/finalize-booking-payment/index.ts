import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = "noreply@location-entre-belges.be";
const FROM_NAME = "Location Entre Belges";

async function sendEmail(to: string, subject: string, html: string) {
  if (!RESEND_API_KEY || !to) return;
  try {
    await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ from: `${FROM_NAME} <${FROM_EMAIL}>`, to, subject, html }),
    });
  } catch (_) {}
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function renderRenterEmail(data: {
  listing_name: string;
  owner_name: string;
  start_date: string;
  end_date: string;
  total_price: string;
  deposit: number;
  booking_id: string;
}): { subject: string; html: string } {
  return {
    subject: "Paiement confirmé — Votre réservation est active",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #f9f9f9;">
        <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
          <h2 style="color: #1B4332; margin-bottom: 8px;">Paiement confirmé !</h2>
          <p style="color: #6b6b6b; font-size: 15px; line-height: 1.6;">
            Votre paiement pour <strong>${data.listing_name}</strong> a bien été reçu.
          </p>
          <div style="background: #f0fdf4; border-left: 4px solid #1B4332; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #1B4332;"><strong>Propriétaire :</strong> ${data.owner_name}</p>
            <p style="margin: 8px 0 0; font-size: 14px; color: #1B4332;"><strong>Du :</strong> ${data.start_date}</p>
            <p style="margin: 4px 0 0; font-size: 14px; color: #1B4332;"><strong>Au :</strong> ${data.end_date}</p>
            <p style="margin: 8px 0 0; font-size: 14px; color: #1B4332;"><strong>Total payé :</strong> ${data.total_price} €</p>
            ${data.deposit > 0 ? `<p style="margin: 4px 0 0; font-size: 14px; color: #92400e;"><strong>Caution bloquée :</strong> ${data.deposit} €</p>` : ""}
          </div>
          <p style="color: #9b9b9b; font-size: 13px; margin-top: 32px;">L'équipe Location Entre Belges</p>
        </div>
      </div>
    `,
  };
}

function renderOwnerEmail(data: {
  listing_name: string;
  renter_name: string;
  start_date: string;
  end_date: string;
  owner_earnings: string;
  booking_id: string;
}): { subject: string; html: string } {
  return {
    subject: "Paiement reçu — Votre location est confirmée",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #f9f9f9;">
        <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
          <h2 style="color: #1B4332; margin-bottom: 8px;">Paiement reçu !</h2>
          <p style="color: #6b6b6b; font-size: 15px; line-height: 1.6;">
            Le paiement pour <strong>${data.listing_name}</strong> a été effectué par <strong>${data.renter_name}</strong>.
          </p>
          <div style="background: #f0fdf4; border-left: 4px solid #1B4332; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #1B4332;"><strong>Du :</strong> ${data.start_date}</p>
            <p style="margin: 4px 0 0; font-size: 14px; color: #1B4332;"><strong>Au :</strong> ${data.end_date}</p>
            <p style="margin: 8px 0 0; font-size: 14px; color: #1B4332;"><strong>Vos gains :</strong> ${data.owner_earnings} €</p>
          </div>
          <p style="color: #9b9b9b; font-size: 13px; margin-top: 32px;">L'équipe Location Entre Belges</p>
        </div>
      </div>
    `,
  };
}

const PAYABLE_STATUSES = ["pending_payment", "accepted", "pending"];

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

    const { booking_id, rental_payment_intent_id, deposit_payment_intent_id } = await req.json();

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
        renter_id, owner_id,
        listing:listings(name),
        owner:profiles!bookings_owner_id_fkey(username, email)
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

    if (!PAYABLE_STATUSES.includes(booking.status)) {
      return new Response(
        JSON.stringify({ error: "Cette réservation a déjà été finalisée." }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const updateData: Record<string, any> = { status: "active" };
    if (deposit_payment_intent_id) updateData.stripe_payment_intent_id = deposit_payment_intent_id;
    if (rental_payment_intent_id) updateData.stripe_transfer_id = rental_payment_intent_id;

    await supabaseAdmin.from("bookings").update(updateData).eq("id", booking_id);

    const { data: renterProfile } = await supabaseAdmin
      .from("profiles")
      .select("email")
      .eq("id", user.id)
      .maybeSingle();

    const feePercent = 0.07;
    const totalNow = (Math.round(booking.total_price * (1 + feePercent) * 100) / 100).toFixed(2);
    const ownerEarnings = (booking.total_price * 0.92).toFixed(2);
    const listingName = (booking.listing as any)?.name ?? "Location";
    const ownerName = (booking.owner as any)?.username ?? "le propriétaire";
    const ownerEmail = (booking.owner as any)?.email ?? null;

    if (renterProfile?.email) {
      const { subject, html } = renderRenterEmail({
        listing_name: listingName,
        owner_name: ownerName,
        start_date: formatDate(booking.start_date),
        end_date: formatDate(booking.end_date),
        total_price: totalNow,
        deposit: booking.deposit_amount ?? 0,
        booking_id,
      });
      await sendEmail(renterProfile.email, subject, html);
    }

    if (ownerEmail) {
      const renterMeta = user.user_metadata as any;
      const renterName = renterMeta?.username ?? renterMeta?.full_name ?? "un locataire";
      const { subject, html } = renderOwnerEmail({
        listing_name: listingName,
        renter_name: renterName,
        start_date: formatDate(booking.start_date),
        end_date: formatDate(booking.end_date),
        owner_earnings: ownerEarnings,
        booking_id,
      });
      await sendEmail(ownerEmail, subject, html);
    }

    return new Response(
      JSON.stringify({ success: true }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message ?? "Erreur interne" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
