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

function renderAcceptedEmail(data: {
  listing_name: string;
  owner_name: string;
  start_date: string;
  end_date: string;
  total_price: number;
  deposit: number;
  booking_id: string;
}): { subject: string; html: string } {
  return {
    subject: "Bonne nouvelle — Votre demande a été acceptée !",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #f9f9f9;">
        <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
          <h2 style="color: #1B4332; margin-bottom: 8px;">Demande acceptée !</h2>
          <p style="color: #6b6b6b; font-size: 15px; line-height: 1.6;">
            <strong>${data.owner_name}</strong> a accepté votre demande pour <strong>${data.listing_name}</strong>.
          </p>
          <div style="background: #f0fdf4; border-left: 4px solid #1B4332; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #1B4332;"><strong>Du :</strong> ${data.start_date}</p>
            <p style="margin: 4px 0 0; font-size: 14px; color: #1B4332;"><strong>Au :</strong> ${data.end_date}</p>
            <p style="margin: 8px 0 0; font-size: 14px; color: #1B4332;"><strong>Montant :</strong> ${data.total_price} €</p>
            ${data.deposit > 0 ? `<p style="margin: 4px 0 0; font-size: 14px; color: #92400e;"><strong>Caution :</strong> ${data.deposit} €</p>` : ""}
          </div>
          <p style="color: #6b6b6b; font-size: 14px; line-height: 1.6;">
            Rendez-vous dans la messagerie pour finaliser le paiement et confirmer votre réservation.
          </p>
          <p style="color: #9b9b9b; font-size: 13px; margin-top: 32px;">L'équipe Location Entre Belges</p>
        </div>
      </div>
    `,
  };
}

function renderRejectedEmail(data: {
  listing_name: string;
  owner_name: string;
}): { subject: string; html: string } {
  return {
    subject: "Votre demande de location n'a pas été acceptée",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #f9f9f9;">
        <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
          <h2 style="color: #2c2c2c; margin-bottom: 8px;">Demande refusée</h2>
          <p style="color: #6b6b6b; font-size: 15px; line-height: 1.6;">
            <strong>${data.owner_name}</strong> n'a pas pu accepter votre demande pour <strong>${data.listing_name}</strong>.
          </p>
          <p style="color: #6b6b6b; font-size: 14px; line-height: 1.6;">
            Vous pouvez rechercher d'autres annonces disponibles sur la plateforme.
          </p>
          <p style="color: #9b9b9b; font-size: 13px; margin-top: 32px;">L'équipe Location Entre Belges</p>
        </div>
      </div>
    `,
  };
}

function renderDepositReleasedEmail(data: {
  listing_name: string;
  deposit: number;
  owner_name: string;
}): { subject: string; html: string } {
  return {
    subject: "Votre caution a été libérée",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #f9f9f9;">
        <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
          <h2 style="color: #1B4332; margin-bottom: 8px;">Caution libérée</h2>
          <p style="color: #6b6b6b; font-size: 15px; line-height: 1.6;">
            La caution de <strong>${data.deposit} €</strong> pour <strong>${data.listing_name}</strong> a été libérée par <strong>${data.owner_name}</strong>.
          </p>
          <p style="color: #6b6b6b; font-size: 14px; line-height: 1.6;">
            Le montant sera recrédité sur votre moyen de paiement dans les prochains jours selon votre banque.
          </p>
          <p style="color: #9b9b9b; font-size: 13px; margin-top: 32px;">L'équipe Location Entre Belges</p>
        </div>
      </div>
    `,
  };
}

function renderDisputeEmail(data: {
  listing_name: string;
  start_date: string;
  end_date: string;
  deposit: number;
  dispute_id: string;
}): { subject: string; html: string } {
  return {
    subject: "Un litige a été ouvert pour votre location",
    html: `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #f9f9f9;">
        <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
          <h2 style="color: #c25450; margin-bottom: 8px;">Litige ouvert</h2>
          <p style="color: #6b6b6b; font-size: 15px; line-height: 1.6;">
            Un litige a été ouvert concernant la location de <strong>${data.listing_name}</strong>.
          </p>
          <div style="background: #fdecea; border-left: 4px solid #c25450; padding: 16px; border-radius: 8px; margin: 20px 0;">
            <p style="margin: 0; font-size: 14px; color: #c25450;"><strong>Du :</strong> ${data.start_date}</p>
            <p style="margin: 4px 0 0; font-size: 14px; color: #c25450;"><strong>Au :</strong> ${data.end_date}</p>
            ${data.deposit > 0 ? `<p style="margin: 8px 0 0; font-size: 14px; color: #c25450;"><strong>Caution bloquée :</strong> ${data.deposit} €</p>` : ""}
          </div>
          <p style="color: #6b6b6b; font-size: 14px; line-height: 1.6;">
            Notre équipe va examiner la situation. La caution reste bloquée jusqu'à résolution.
          </p>
          <p style="color: #9b9b9b; font-size: 13px; margin-top: 32px;">L'équipe Location Entre Belges</p>
        </div>
      </div>
    `,
  };
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

    const body = await req.json();
    const { event, conversation_id, booking_id } = body;

    if (!event) {
      return new Response(
        JSON.stringify({ error: "event requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
          id, listing_id, requester_id,
          listing:listings(name, price_per_day),
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

      const renterEmail = (conv.requester as any)?.email ?? null;
      if (!renterEmail) {
        return new Response(
          JSON.stringify({ success: true, skipped: "no renter email" }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const ownerName = (conv.owner as any)?.username ?? "le propriétaire";
      const listingName = (conv.listing as any)?.name ?? "Location";

      if (event === "booking_accepted") {
        const { data: bookingRow } = await supabaseAdmin
          .from("bookings")
          .select("id, total_price, deposit_amount, start_date, end_date")
          .eq("conversation_id", conversation_id)
          .maybeSingle();

        const { subject, html } = renderAcceptedEmail({
          listing_name: listingName,
          owner_name: ownerName,
          start_date: bookingRow?.start_date ? formatDate(bookingRow.start_date) : "",
          end_date: bookingRow?.end_date ? formatDate(bookingRow.end_date) : "",
          total_price: bookingRow?.total_price ?? 0,
          deposit: bookingRow?.deposit_amount ?? 0,
          booking_id: bookingRow?.id ?? "",
        });
        await sendEmail(renterEmail, subject, html);
      } else {
        const { subject, html } = renderRejectedEmail({ listing_name: listingName, owner_name: ownerName });
        await sendEmail(renterEmail, subject, html);
      }
    } else if (event === "deposit_released") {
      if (!booking_id) {
        return new Response(
          JSON.stringify({ error: "booking_id requis" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: bookingRow } = await supabaseAdmin
        .from("bookings")
        .select("renter_id, deposit_amount, listing:listings(name), owner:profiles!bookings_owner_id_fkey(username)")
        .eq("id", booking_id)
        .maybeSingle();

      if (!bookingRow) {
        return new Response(
          JSON.stringify({ error: "Réservation introuvable" }),
          { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: renterProfile } = await supabaseAdmin
        .from("profiles")
        .select("email")
        .eq("id", bookingRow.renter_id)
        .maybeSingle();

      if (renterProfile?.email) {
        const { subject, html } = renderDepositReleasedEmail({
          listing_name: (bookingRow.listing as any)?.name ?? "Location",
          deposit: bookingRow.deposit_amount ?? 0,
          owner_name: (bookingRow.owner as any)?.username ?? "le propriétaire",
        });
        await sendEmail(renterProfile.email, subject, html);
      }
    } else if (event === "dispute_opened") {
      if (!booking_id) {
        return new Response(
          JSON.stringify({ error: "booking_id requis" }),
          { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const { data: bookingRow } = await supabaseAdmin
        .from("bookings")
        .select("renter_id, owner_id, deposit_amount, start_date, end_date, listing:listings(name)")
        .eq("id", booking_id)
        .maybeSingle();

      if (bookingRow) {
        const listingName = (bookingRow.listing as any)?.name ?? "Location";
        const emailData = {
          listing_name: listingName,
          start_date: formatDate(bookingRow.start_date),
          end_date: formatDate(bookingRow.end_date),
          deposit: bookingRow.deposit_amount ?? 0,
          dispute_id: booking_id,
        };

        const { data: renterP } = await supabaseAdmin.from("profiles").select("email").eq("id", bookingRow.renter_id).maybeSingle();
        const { data: ownerP } = await supabaseAdmin.from("profiles").select("email").eq("id", bookingRow.owner_id).maybeSingle();

        const { subject, html } = renderDisputeEmail(emailData);
        if (renterP?.email) await sendEmail(renterP.email, subject, html);
        if (ownerP?.email) await sendEmail(ownerP.email, subject, html);
      }
    } else {
      return new Response(
        JSON.stringify({ error: `Événement inconnu: ${event}` }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
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
