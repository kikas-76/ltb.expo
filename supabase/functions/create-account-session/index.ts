import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

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
      .select("stripe_account_id, username, phone_number, business_type, business_name, siren_number, location_data, is_pro, bio")
      .eq("id", user.id)
      .maybeSingle();

    let accountId: string = profile?.stripe_account_id ?? "";

    const username: string = profile?.username ?? "";
    const nameParts = username.trim().split(" ");
    const firstName = nameParts[0] ?? "";
    const lastName = nameParts.slice(1).join(" ") || firstName;
    const rawPhone: string = profile?.phone_number ?? "";
    const digits = rawPhone.replace(/\D/g, "");
    let phone = "";
    if (digits.length === 10 && digits.startsWith("0")) {
      phone = "+33" + digits.slice(1);
    } else if (digits.length === 11 && digits.startsWith("33")) {
      phone = "+" + digits;
    } else if (digits.length === 12 && digits.startsWith("033")) {
      phone = "+" + digits.slice(1);
    } else if (digits.length > 0) {
      phone = "+" + digits;
    }
    const locationData = profile?.location_data as Record<string, string> | null;
    const isPro = profile?.is_pro && profile?.business_name;

    if (!accountId) {
      const createParams: Stripe.AccountCreateParams = {
        type: "express",
        email: user.email,
        country: "FR",
        default_currency: "eur",
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
      };

      if (isPro) {
        createParams.business_type = "company";
        createParams.company = {
          name: profile!.business_name,
          ...(phone ? { phone } : {}),
          ...(locationData?.city ? { address: { city: locationData.city, country: "FR" } } : {}),
        };
        createParams.business_profile = {
          ...(profile?.business_name ? { name: profile.business_name } : {}),
          support_email: user.email,
        };
      } else {
        createParams.business_type = "individual";
        createParams.individual = {
          ...(firstName ? { first_name: firstName } : {}),
          ...(lastName ? { last_name: lastName } : {}),
          email: user.email ?? "",
          ...(phone ? { phone } : {}),
          ...(locationData?.city ? { address: { city: locationData.city, country: "FR" } } : {}),
        };
        createParams.business_profile = {
          support_email: user.email,
        };
      }

      const account = await stripe.accounts.create(createParams);
      accountId = account.id;

      await supabase
        .from("profiles")
        .update({ stripe_account_id: accountId })
        .eq("id", user.id);
    }

    if (!accountId) {
      return new Response(JSON.stringify({ error: "Impossible de créer le compte Stripe" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const accountSession = await stripe.accountSessions.create({
      account: accountId,
      components: {
        account_onboarding: { enabled: true },
      },
    });

    return new Response(JSON.stringify({ client_secret: accountSession.client_secret }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err: unknown) {
    const message = err instanceof Error ? err.message : "Internal error";
    return new Response(JSON.stringify({ error: message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
