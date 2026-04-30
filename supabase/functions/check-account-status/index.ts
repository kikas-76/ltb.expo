import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";
import { buildCorsHeaders, preflightResponse, type CorsOptions } from "../_shared/cors.ts";

const corsOpts: CorsOptions = { methods: "POST, OPTIONS" };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req, corsOpts);
  }
  const corsHeaders = buildCorsHeaders(req, corsOpts);

  try {
    const stripe = new Stripe(Deno.env.get("STRIPE_SECRET_KEY") ?? "", {
      apiVersion: "2024-06-20",
    });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_account_id, stripe_onboarding_complete")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.stripe_account_id) {
      return new Response(JSON.stringify({ complete: false }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Always go to Stripe — the early-return on the local boolean used
    // to skip the API call, which made the app blind to a *re-disabled*
    // account (KYC re-verification, missing docs). The webhook handles
    // most updates live, but a manual sync from the wallet should
    // never trust a possibly-stale local flag.
    const account = await stripe.accounts.retrieve(profile.stripe_account_id);

    const chargesEnabled = account.charges_enabled === true;
    const payoutsEnabled = account.payouts_enabled === true;
    const detailsSubmitted = account.details_submitted === true;
    const complete = chargesEnabled && payoutsEnabled && detailsSubmitted;

    const rawReq: any = account.requirements ?? {};
    const requirements = {
      currently_due: Array.isArray(rawReq.currently_due) ? rawReq.currently_due : [],
      past_due: Array.isArray(rawReq.past_due) ? rawReq.past_due : [],
      disabled_reason: rawReq.disabled_reason ?? null,
      current_deadline: rawReq.current_deadline ?? null,
    };

    await supabase
      .from("profiles")
      .update({
        stripe_onboarding_complete: complete,
        stripe_charges_enabled: chargesEnabled,
        stripe_payouts_enabled: payoutsEnabled,
        stripe_details_submitted: detailsSubmitted,
        stripe_requirements: requirements,
      })
      .eq("id", user.id);

    return new Response(
      JSON.stringify({
        complete,
        charges_enabled: chargesEnabled,
        payouts_enabled: payoutsEnabled,
        details_submitted: detailsSubmitted,
        requirements,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: message, complete: false }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
