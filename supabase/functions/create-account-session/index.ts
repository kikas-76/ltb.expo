import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";
import Stripe from "npm:stripe@14";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const APP_BASE_URL = Deno.env.get("APP_BASE_URL") ?? "https://louetonbien.fr";

type ProfileRow = {
  stripe_account_id?: string | null;
  username?: string | null;
  phone_number?: string | null;
  business_type?: string | null;
  business_name?: string | null;
  siren_number?: string | null;
  location_data?: Record<string, string> | null;
  is_pro?: boolean | null;
  bio?: string | null;
};

function normalizePhone(rawPhone?: string | null): string | undefined {
  const digits = (rawPhone ?? "").replace(/\D/g, "");
  if (!digits) return undefined;
  if (digits.length === 11 && digits.startsWith("330")) return "+33" + digits.slice(3);
  if (digits.length === 10 && digits.startsWith("0")) return "+33" + digits.slice(1);
  if (digits.length === 11 && digits.startsWith("33")) return "+" + digits;
  if (digits.length === 12 && digits.startsWith("033")) return "+" + digits.slice(1);
  if (digits.length >= 9) return "+" + digits;
  return undefined;
}

function splitName(username?: string | null): { firstName?: string; lastName?: string } {
  const trimmed = (username ?? "").trim();
  if (!trimmed) return {};
  const nameParts = trimmed.split(/\s+/);
  const firstName = nameParts[0] ?? undefined;
  const lastName = nameParts.slice(1).join(" ") || firstName;
  return { firstName, lastName };
}

function isProfessional(profile: ProfileRow | null): boolean {
  return Boolean(profile?.is_pro && profile?.business_name);
}

function buildBusinessProfile(
  userEmail?: string,
  phone?: string,
  isProValue = false,
  businessName?: string,
) {
  const payload: Record<string, string> = {
    url: APP_BASE_URL,
    support_email: userEmail ?? "",
    product_description: isProValue
      ? "Mise en location d'objets via LoueTonBien"
      : "Location d'objets entre particuliers via LoueTonBien",
  };

  if (!payload.support_email) delete payload.support_email;
  if (phone) payload.support_phone = phone;
  if (isProValue && businessName) payload.name = businessName;

  return payload;
}

function buildCreateParams(
  userEmail: string | undefined,
  profile: ProfileRow | null,
): Stripe.AccountCreateParams {
  const phone = normalizePhone(profile?.phone_number);
  const { firstName, lastName } = splitName(profile?.username);
  const locationData = profile?.location_data ?? null;
  const isProValue = isProfessional(profile);

  const payload: Stripe.AccountCreateParams = {
    type: "express",
    email: userEmail,
    country: "FR",
    default_currency: "eur",
    capabilities: {
      card_payments: { requested: true },
      transfers: { requested: true },
    },
    business_profile: buildBusinessProfile(
      userEmail,
      phone,
      isProValue,
      profile?.business_name,
    ) as Stripe.AccountCreateParams.BusinessProfile,
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

  // Build address from location_data (individuals) or business_address (pros)
  const buildAddress = (useBusiness: boolean) => {
    const addr: Record<string, string> = { country: "FR" };
    if (useBusiness && profile?.business_address) {
      addr.line1 = profile.business_address;
    } else if (locationData?.address) {
      addr.line1 = locationData.address;
    }
    if (locationData?.city) addr.city = locationData.city;
    if (locationData?.postal_code) addr.postal_code = locationData.postal_code;
    return Object.keys(addr).length > 1 ? addr : undefined;
  };

  if (isProValue) {
    payload.business_type = "company";
    const address = buildAddress(true);
    payload.company = {
      name: profile?.business_name ?? undefined,
      ...(phone ? { phone } : {}),
      ...(address ? { address } : {}),
      ...(profile?.siren_number ? { tax_id: profile.siren_number } : {}),
    };
  } else {
    payload.business_type = "individual";
    const address = buildAddress(false);
    payload.individual = {
      ...(firstName ? { first_name: firstName } : {}),
      ...(lastName ? { last_name: lastName } : {}),
      ...(userEmail ? { email: userEmail } : {}),
      ...(phone ? { phone } : {}),
      ...(address ? { address } : {}),
    };
  }

  return payload;
}

function buildUpdateParams(
  userEmail: string | undefined,
  profile: ProfileRow | null,
  detailsSubmitted: boolean,
): Stripe.AccountUpdateParams {
  const phone = normalizePhone(profile?.phone_number);
  const { firstName, lastName } = splitName(profile?.username);
  const locationData = profile?.location_data ?? null;
  const isProValue = isProfessional(profile);

  const payload: Stripe.AccountUpdateParams = {
    business_profile: buildBusinessProfile(
      userEmail,
      phone,
      isProValue,
      profile?.business_name,
    ) as Stripe.AccountUpdateParams.BusinessProfile,
  };

  if (!detailsSubmitted) {
    if (userEmail) payload.email = userEmail;
    payload.business_type = isProValue ? "company" : "individual";

    if (isProValue) {
      payload.company = {
        name: profile?.business_name ?? undefined,
        ...(phone ? { phone } : {}),
        ...(locationData?.city ? { address: { city: locationData.city, country: "FR" } } : {}),
      };
    } else {
      payload.individual = {
        ...(firstName ? { first_name: firstName } : {}),
        ...(lastName ? { last_name: lastName } : {}),
        ...(userEmail ? { email: userEmail } : {}),
        ...(phone ? { phone } : {}),
        ...(locationData?.city ? { address: { city: locationData.city, country: "FR" } } : {}),
      };
    }
  }

  return payload;
}

async function createFreshAccount(
  stripe: Stripe,
  supabase: ReturnType<typeof createClient>,
  userId: string,
  userEmail: string | undefined,
  profile: ProfileRow | null,
): Promise<string> {
  const account = await stripe.accounts.create(buildCreateParams(userEmail, profile));
  await supabase
    .from("profiles")
    .update({ stripe_account_id: account.id })
    .eq("id", userId);
  return account.id;
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
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
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
      .select("stripe_account_id, username, phone_number, business_type, business_name, siren_number, location_data, is_pro, bio, business_address")
      .eq("id", user.id)
      .maybeSingle();

    let accountId: string = profile?.stripe_account_id ?? "";
    const desiredBusinessType = isProfessional(profile) ? "company" : "individual";

    if (!accountId) {
      accountId = await createFreshAccount(
        stripe,
        supabase,
        user.id,
        user.email ?? undefined,
        profile,
      );
    } else {
      const existingAccount = await stripe.accounts.retrieve(accountId);

      if ("deleted" in existingAccount && existingAccount.deleted) {
        accountId = await createFreshAccount(
          stripe,
          supabase,
          user.id,
          user.email ?? undefined,
          profile,
        );
      } else {
        try {
          await stripe.accounts.update(
            accountId,
            buildUpdateParams(user.email ?? undefined, profile, existingAccount.details_submitted ?? false),
          );
        } catch (updateError) {
          const canReplaceAccount =
            !existingAccount.details_submitted &&
            existingAccount.business_type !== null &&
            existingAccount.business_type !== desiredBusinessType;

          if (!canReplaceAccount) throw updateError;

          accountId = await createFreshAccount(
            stripe,
            supabase,
            user.id,
            user.email ?? undefined,
            profile,
          );
        }
      }
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
