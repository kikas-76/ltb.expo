import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import { buildCorsHeaders, preflightResponse, type CorsOptions } from "../_shared/cors.ts";

const corsOpts: CorsOptions = { methods: "GET, POST, OPTIONS" };

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req, corsOpts);
  }
  const corsHeaders = buildCorsHeaders(req, corsOpts);

  try {
    const stripeKey = Deno.env.get("STRIPE_SECRET_KEY");
    if (!stripeKey) {
      return new Response(
        JSON.stringify({ error: "Stripe non configuré" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    const { access_token } = await req.json();
    if (!access_token) {
      return new Response(
        JSON.stringify({ error: "access_token requis" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: { user }, error: authError } = await supabase.auth.getUser(access_token);
    if (authError || !user) {
      return new Response(
        JSON.stringify({ error: "Non authentifié" }),
        { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const { data: profile } = await supabase
      .from("profiles")
      .select("stripe_account_id")
      .eq("id", user.id)
      .maybeSingle();

    if (!profile?.stripe_account_id) {
      return new Response(
        JSON.stringify({ error: "Aucun compte Stripe lié" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const accountId = profile.stripe_account_id;
    const stripeHeaders = {
      "Authorization": `Bearer ${stripeKey}`,
      "Stripe-Version": "2024-06-20",
    };
    const connectedHeaders = { ...stripeHeaders, "Stripe-Account": accountId };

    const [accountRes, balanceRes, payoutsRes, transfersRes] = await Promise.all([
      fetch(`https://api.stripe.com/v1/accounts/${accountId}`, { headers: stripeHeaders }),
      fetch(`https://api.stripe.com/v1/balance`, { headers: connectedHeaders }),
      fetch(`https://api.stripe.com/v1/payouts?limit=10`, { headers: connectedHeaders }),
      fetch(`https://api.stripe.com/v1/transfers?destination=${accountId}&limit=10`, { headers: stripeHeaders }),
    ]);

    const [account, balance, payouts, transfers] = await Promise.all([
      accountRes.json(),
      balanceRes.json(),
      payoutsRes.json(),
      transfersRes.json(),
    ]);

    const availableBalance = (balance.available ?? []).reduce((sum: number, b: any) => sum + b.amount, 0);
    const pendingBalance = (balance.pending ?? []).reduce((sum: number, b: any) => sum + b.amount, 0);

    const response = {
      account: {
        id: account.id,
        email: account.email,
        charges_enabled: account.charges_enabled ?? false,
        payouts_enabled: account.payouts_enabled ?? false,
        details_submitted: account.details_submitted ?? false,
        country: account.country,
        default_currency: account.default_currency,
        business_type: account.business_type,
        created: account.created,
        individual_name: account.individual
          ? `${account.individual.first_name ?? ""} ${account.individual.last_name ?? ""}`.trim()
          : null,
        phone: account.individual?.phone ?? null,
        external_accounts: (account.external_accounts?.data ?? []).map((ea: any) => ({
          id: ea.id,
          bank_name: ea.bank_name,
          last4: ea.last4,
          currency: ea.currency,
          status: ea.status,
        })),
        requirements: {
          currently_due: account.requirements?.currently_due ?? [],
          eventually_due: account.requirements?.eventually_due ?? [],
          past_due: account.requirements?.past_due ?? [],
          disabled_reason: account.requirements?.disabled_reason ?? null,
        },
      },
      balance: {
        available: availableBalance,
        pending: pendingBalance,
        currency: "eur",
      },
      payouts: (payouts.data ?? []).map((p: any) => ({
        id: p.id,
        amount: p.amount,
        currency: p.currency,
        status: p.status,
        arrival_date: p.arrival_date,
        created: p.created,
      })),
      payments: (transfers.data ?? []).map((t: any) => ({
        id: t.id,
        amount: t.amount,
        currency: t.currency,
        status: t.reversed ? "reversed" : "paid",
        created: t.created,
        description: t.metadata?.booking_id ? `Location #${t.metadata.booking_id.slice(0, 8)}` : (t.description || "Location"),
      })),
    };

    return new Response(
      JSON.stringify(response),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    return new Response(
      JSON.stringify({ error: err.message ?? "Erreur interne" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
