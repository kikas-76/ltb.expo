import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { constantTimeEquals, requireEnv } from "../_shared/auth.ts";

// Daily cron: for every booking that reached `completed` between 24h
// and 14 days ago, send a review_reminder email to each participant
// who hasn't left a review yet. Idempotent — once a review row exists
// for (booking_id, reviewer_id), that participant is filtered out.
//
// Auth: x-internal-secret header. Crash on missing env var (mirrors
// the other cron functions). verify_jwt: false at deploy time.

const INTERNAL_SECRET = requireEnv("INTERNAL_EDGE_SECRET");

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-secret",
};

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

async function dispatchEmail(to: string, template: string, data: Record<string, unknown>) {
  // Direct fetch with explicit headers — supabase-js's
  // .functions.invoke() in Deno doesn't reliably attach Authorization,
  // hits send-email's auth gate. See chat-notify for the same fix.
  try {
    const res = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${SERVICE_ROLE_KEY}`,
        "apikey": SERVICE_ROLE_KEY,
        "x-internal-secret": INTERNAL_SECRET,
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

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const provided = req.headers.get("x-internal-secret");
    if (!constantTimeEquals(provided, INTERNAL_SECRET)) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    // Window: completed at least 24h ago, but not more than 14 days
    // ago — older bookings are past the editable window anyway.
    const now = Date.now();
    const lowerBound = new Date(now - 14 * 24 * 60 * 60 * 1000).toISOString();
    const upperBound = new Date(now - 24 * 60 * 60 * 1000).toISOString();

    const { data: bookings, error } = await supabase
      .from("bookings")
      .select(`
        id, renter_id, owner_id, return_confirmed_at,
        listing:listings(name),
        renter:profiles!bookings_renter_id_fkey(email),
        owner:profiles!bookings_owner_id_fkey(email)
      `)
      .eq("status", "completed")
      .not("return_confirmed_at", "is", null)
      .gte("return_confirmed_at", lowerBound)
      .lte("return_confirmed_at", upperBound);

    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    if (!bookings || bookings.length === 0) {
      return new Response(
        JSON.stringify({ success: true, candidates: 0, sent: 0 }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const bookingIds = bookings.map((b: any) => b.id);
    const { data: existingReviews } = await supabase
      .from("reviews")
      .select("booking_id, reviewer_id")
      .in("booking_id", bookingIds);

    const reviewedKeys = new Set<string>(
      (existingReviews ?? []).map(
        (r: any) => `${r.booking_id}:${r.reviewer_id}`,
      ),
    );

    let sent = 0;
    for (const b of bookings as any[]) {
      const listingName = b.listing?.name ?? "ta location";
      // Renter side
      if (!reviewedKeys.has(`${b.id}:${b.renter_id}`) && b.renter?.email) {
        await dispatchEmail(b.renter.email, "review_reminder", {
          listing_name: listingName,
          booking_id: b.id,
        });
        sent++;
      }
      // Owner side
      if (!reviewedKeys.has(`${b.id}:${b.owner_id}`) && b.owner?.email) {
        await dispatchEmail(b.owner.email, "review_reminder", {
          listing_name: listingName,
          booking_id: b.id,
        });
        sent++;
      }
    }

    return new Response(
      JSON.stringify({ success: true, candidates: bookings.length, sent }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("review-reminder error:", err);
    return new Response(
      JSON.stringify({ error: err?.message ?? "Internal error" }),
      {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
