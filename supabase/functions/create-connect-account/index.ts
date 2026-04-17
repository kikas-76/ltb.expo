import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const APP_BASE_URL = "https://app.louetonbien.fr";
// MCC 7394 = Equipment, Tool, Furniture, and Appliance Rental and Leasing.
const LTB_MCC = "7394";

function normalizePhone(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const digits = raw.replace(/\D/g, "");
  if (digits.length === 11 && digits.startsWith("330")) return `+${digits.slice(1)}`;
  if (digits.length === 10 && digits.startsWith("0")) return `+33${digits.slice(1)}`;
  if (digits.length === 11 && digits.startsWith("33")) return `+${digits}`;
  if (digits.length >= 9) return `+${digits}`;
  return undefined;
}

// Prefer display_name (legal name from the wallet pre-onboarding form).
// Fall back to username only for older accounts that never set it.
function splitLegalName(profile: { display_name?: string | null; username?: string | null } | null) {
  const trimmed = ((profile?.display_name ?? profile?.username) ?? "").trim();
  const parts = trimmed.split(/\s+/);
  const firstName = parts[0] || undefined;
  const lastName = parts.length > 1 ? parts.slice(1).join(" ") : firstName;
  return { firstName, lastName };
}

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
      .select("stripe_account_id, username, display_name, phone_number, is_pro, business_name, siren_number, location_data, business_address")
      .eq("id", user.id)
      .maybeSingle();

    let accountId: string = profile?.stripe_account_id ?? "";

    if (!accountId) {
      const phone = normalizePhone(profile?.phone_number);
      const { firstName, lastName } = splitLegalName(profile);
      const locationData = profile?.location_data;
      const isPro = Boolean(profile?.is_pro && profile?.business_name);

      const accountParams: Stripe.AccountCreateParams = {
        type: "express",
        country: "FR",
        default_currency: "eur",
        email: user.email,
        capabilities: {
          card_payments: { requested: true },
          transfers: { requested: true },
        },
        business_profile: {
          mcc: LTB_MCC,
          url: APP_BASE_URL,
          support_email: user.email ?? undefined,
          product_description: isPro
            ? "Mise en location d'objets via LoueTonBien"
            : "Location d'objets entre particuliers via LoueTonBien",
          ...(phone ? { support_phone: phone } : {}),
          ...(isPro && profile?.business_name ? { name: profile.business_name } : {}),
        },
        settings: {
          payouts: {
            schedule: {
              delay_days: 14,
              interval: "weekly",
              weekly_anchor: "monday",
            },
          },
        },
      };

      if (isPro) {
        accountParams.business_type = "company";
        accountParams.company = {
          name: profile?.business_name ?? undefined,
          ...(phone ? { phone } : {}),
          ...(profile?.business_address
            ? { address: { line1: profile.business_address, city: locationData?.city, country: "FR" } }
            : locationData?.city
              ? { address: { city: locationData.city, country: "FR" } }
              : {}),
          ...(profile?.siren_number ? { tax_id: profile.siren_number } : {}),
        };
      } else {
        accountParams.business_type = "individual";
        accountParams.individual = {
          ...(firstName ? { first_name: firstName } : {}),
          ...(lastName ? { last_name: lastName } : {}),
          email: user.email ?? undefined,
          ...(phone ? { phone } : {}),
          ...(locationData?.city
            ? { address: { city: locationData.city, country: "FR" } }
            : {}),
        };
      }

      const account = await stripe.accounts.create(accountParams);
      accountId = account.id;

      await supabase
        .from("profiles")
        .update({ stripe_account_id: accountId })
        .eq("id", user.id);
    }

    const origin = req.headers.get("origin") ?? APP_BASE_URL;

    const accountLink = await stripe.accountLinks.create({
      account: accountId,
      refresh_url: `${origin}/wallet/refresh`,
      return_url: `${origin}/wallet/success`,
      type: "account_onboarding",
    });

    return new Response(JSON.stringify({ url: accountLink.url }), {
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
