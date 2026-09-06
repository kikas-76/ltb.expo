import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { constantTimeEquals, requireEnv } from "../_shared/auth.ts";
import { sendPushToUsers, alreadyNotified } from "../_shared/push.ts";

// Rappels quotidiens (cron 07:00 UTC ≈ 09:00 Paris), authentifiés par
// x-internal-secret comme review-reminder :
//  - veille du début de location (locataire + propriétaire)
//  - jour du retour (locataire + propriétaire)
//  - retour confirmé par le locataire depuis plus de 12 h, validation du
//    propriétaire toujours attendue
// Chaque rappel est envoyé une seule fois par réservation (clé dans data.key).

const INTERNAL_SECRET = requireEnv("INTERNAL_EDGE_SECRET");
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-secret",
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });

const fmt = (iso: string) =>
  new Date(iso).toLocaleDateString("fr-FR", { weekday: "long", day: "numeric", month: "long", timeZone: "Europe/Paris" });

/** Bornes UTC d'un jour calendaire Paris, décalé de `offsetDays` par rapport à aujourd'hui. */
function parisDayWindow(offsetDays: number): { from: string; to: string } {
  const now = new Date();
  const parisToday = new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" }));
  parisToday.setHours(0, 0, 0, 0);
  const tzOffsetMs = now.getTime() - new Date(now.toLocaleString("en-US", { timeZone: "Europe/Paris" })).getTime();
  const from = new Date(parisToday.getTime() + offsetDays * 86400000 + tzOffsetMs);
  const to = new Date(from.getTime() + 86400000);
  return { from: from.toISOString(), to: to.toISOString() };
}

type BookingRow = {
  id: string;
  renter_id: string;
  owner_id: string;
  conversation_id: string | null;
  start_date: string;
  end_date: string;
  status: string;
  return_confirmed_at: string | null;
  listing: { name: string } | { name: string }[] | null;
};

const listingName = (b: BookingRow) => {
  const l = Array.isArray(b.listing) ? b.listing[0] : b.listing;
  return l?.name ?? "votre location";
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const provided = req.headers.get("x-internal-secret");
  if (!constantTimeEquals(provided, INTERNAL_SECRET)) return json({ error: "Unauthorized" }, 401);

  const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);
  const select = "id, renter_id, owner_id, conversation_id, start_date, end_date, status, return_confirmed_at, listing:listings(name)";
  const sent: Record<string, number> = { start_tomorrow: 0, return_today: 0, validation_pending: 0 };

  const notify = async (b: BookingRow, userId: string, type: string, title: string, body: string) => {
    const key = `${b.id}:${type}`;
    if (await alreadyNotified(admin, userId, type, key)) return false;
    await sendPushToUsers(admin, [userId], {
      title,
      body,
      type,
      category: "reminders",
      data: { url: b.conversation_id ? `/chat/${b.conversation_id}` : "/(tabs)/reservations", booking_id: b.id, key },
    });
    return true;
  };

  try {
    // 1) Veille du début de location
    const tomorrow = parisDayWindow(1);
    const { data: starting } = await admin
      .from("bookings")
      .select(select)
      .eq("status", "active")
      .gte("start_date", tomorrow.from)
      .lt("start_date", tomorrow.to);
    for (const b of (starting ?? []) as BookingRow[]) {
      const name = listingName(b);
      if (await notify(b, b.renter_id, "reminder_start_renter", "C'est demain 📦", `Votre location de « ${name} » commence ${fmt(b.start_date)}. Pensez à convenir de la remise.`)) sent.start_tomorrow++;
      if (await notify(b, b.owner_id, "reminder_start_owner", "Remise demain", `« ${name} » est loué à partir de ${fmt(b.start_date)}. Préparez l'objet et le QR code de remise.`)) sent.start_tomorrow++;
    }

    // 2) Jour du retour
    const today = parisDayWindow(0);
    const { data: ending } = await admin
      .from("bookings")
      .select(select)
      .in("status", ["in_progress", "pending_return"])
      .gte("end_date", today.from)
      .lt("end_date", today.to);
    for (const b of (ending ?? []) as BookingRow[]) {
      const name = listingName(b);
      if (await notify(b, b.renter_id, "reminder_return_renter", "Retour aujourd'hui ↩️", `La location de « ${name} » se termine aujourd'hui. Confirmez le retour avec le QR code.`)) sent.return_today++;
      if (await notify(b, b.owner_id, "reminder_return_owner", "Retour prévu aujourd'hui", `« ${name} » vous revient aujourd'hui. Vérifiez l'objet à la remise.`)) sent.return_today++;
    }

    // 3) Validation du retour en attente depuis plus de 12 h
    const twelveHoursAgo = new Date(Date.now() - 12 * 3600 * 1000).toISOString();
    const { data: pending } = await admin
      .from("bookings")
      .select(select)
      .eq("status", "pending_owner_validation")
      .lt("return_confirmed_at", twelveHoursAgo);
    for (const b of (pending ?? []) as BookingRow[]) {
      const name = listingName(b);
      if (await notify(b, b.owner_id, "reminder_validation_owner", "Validation à faire ✅", `Le retour de « ${name} » attend votre validation. Sans action, il sera validé automatiquement sous 24 h.`)) sent.validation_pending++;
    }

    return json({ success: true, sent });
  } catch (err: any) {
    console.error("send-reminders failed:", err);
    return json({ error: err?.message ?? "Erreur interne" }, 500);
  }
});
