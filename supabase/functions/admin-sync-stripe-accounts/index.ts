import "jsr:@supabase/functions-js/edge-runtime.d.ts";

// One-shot sync already executed. Function re-secured: now requires the
// INTERNAL_EDGE_SECRET header. Safe to delete from the Supabase Dashboard
// when convenient (Edge Functions → admin-sync-stripe-accounts → Delete).
const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, x-internal-secret",
};

Deno.serve((req) => {
  if (req.method === "OPTIONS") return new Response(null, { status: 200, headers: corsHeaders });

  const expected = Deno.env.get("INTERNAL_EDGE_SECRET");
  const provided = req.headers.get("x-internal-secret");
  if (!expected || provided !== expected) {
    return new Response(JSON.stringify({ error: "Unauthorized" }), {
      status: 401,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  return new Response(JSON.stringify({ message: "One-shot sync already executed. Delete this function from the dashboard." }), {
    status: 410,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
