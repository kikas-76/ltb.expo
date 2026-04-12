import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2";

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
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Missing authorization" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const userClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: userError } = await userClient.auth.getUser();
    if (userError || !user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const role = user.app_metadata?.role;
    if (role !== "admin") {
      return new Response(JSON.stringify({ error: "Forbidden: admin only" }), {
        status: 403,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const adminClient = createClient(supabaseUrl, serviceKey);

    const { action, target_id, reason, details } = await req.json();

    if (!action || !target_id) {
      return new Response(JSON.stringify({ error: "Missing action or target_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: adminProfile } = await adminClient
      .from("profiles")
      .select("id, username, email")
      .eq("id", user.id)
      .maybeSingle();

    let result: any = {};

    if (action === "suspend_user") {
      const bannedUntil = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
      const { error: updateError } = await adminClient
        .from("profiles")
        .update({
          account_status: "suspended",
          ban_reason: reason ?? "",
          banned_until: bannedUntil,
          banned_by: user.id,
        })
        .eq("id", target_id);

      if (updateError) throw updateError;

      await adminClient.from("user_account_events").insert({
        user_id: target_id,
        event_type: "suspended",
        performed_by: user.id,
        reason: reason ?? "",
        duration_days: 30,
        expires_at: bannedUntil,
      });

      await adminClient.from("admin_audit_logs").insert({
        admin_id: user.id,
        action: "suspend_user",
        target_type: "user",
        target_id,
        details: { reason, banned_until: bannedUntil, admin_username: adminProfile?.username },
      });

      const { data: targetProfile } = await adminClient
        .from("profiles")
        .select("email, username")
        .eq("id", target_id)
        .maybeSingle();

      if (targetProfile?.email) {
        await fetch(`${supabaseUrl}/functions/v1/send-admin-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            to: targetProfile.email,
            template: "account_suspended",
            data: {
              username: targetProfile.username ?? targetProfile.email,
              reason: reason ?? "",
              banned_until: bannedUntil,
            },
          }),
        });
      }

      result = { success: true, action, banned_until: bannedUntil };

    } else if (action === "ban_user") {
      const { error: updateError } = await adminClient
        .from("profiles")
        .update({
          account_status: "banned",
          ban_reason: reason ?? "",
          banned_until: null,
          banned_by: user.id,
        })
        .eq("id", target_id);

      if (updateError) throw updateError;

      await adminClient.from("user_account_events").insert({
        user_id: target_id,
        event_type: "banned",
        performed_by: user.id,
        reason: reason ?? "",
        duration_days: null,
        expires_at: null,
      });

      await adminClient.from("admin_audit_logs").insert({
        admin_id: user.id,
        action: "ban_user",
        target_type: "user",
        target_id,
        details: { reason, admin_username: adminProfile?.username },
      });

      const { data: targetProfile } = await adminClient
        .from("profiles")
        .select("email, username")
        .eq("id", target_id)
        .maybeSingle();

      if (targetProfile?.email) {
        await fetch(`${supabaseUrl}/functions/v1/send-admin-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            to: targetProfile.email,
            template: "account_banned",
            data: {
              username: targetProfile.username ?? targetProfile.email,
              reason: reason ?? "",
            },
          }),
        });
      }

      result = { success: true, action };

    } else if (action === "unban_user") {
      const { error: updateError } = await adminClient
        .from("profiles")
        .update({
          account_status: "active",
          ban_reason: null,
          banned_until: null,
          banned_by: null,
        })
        .eq("id", target_id);

      if (updateError) throw updateError;

      await adminClient.from("user_account_events").insert({
        user_id: target_id,
        event_type: "unbanned",
        performed_by: user.id,
        reason: reason ?? "Compte réactivé",
        duration_days: null,
        expires_at: null,
      });

      await adminClient.from("admin_audit_logs").insert({
        admin_id: user.id,
        action: "unban_user",
        target_type: "user",
        target_id,
        details: { reason: reason ?? "Compte réactivé", admin_username: adminProfile?.username },
      });

      const { data: targetProfile } = await adminClient
        .from("profiles")
        .select("email, username")
        .eq("id", target_id)
        .maybeSingle();

      if (targetProfile?.email) {
        await fetch(`${supabaseUrl}/functions/v1/send-admin-email`, {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${serviceKey}`,
          },
          body: JSON.stringify({
            to: targetProfile.email,
            template: "account_reactivated",
            data: {
              username: targetProfile.username ?? targetProfile.email,
            },
          }),
        });
      }

      result = { success: true, action };

    } else if (action === "flag_transaction") {
      await adminClient.from("admin_audit_logs").insert({
        admin_id: user.id,
        action: "flag_transaction",
        target_type: "booking",
        target_id,
        details: { reason: reason ?? "", ...(details ?? {}), admin_username: adminProfile?.username },
      });

      result = { success: true, action };

    } else {
      return new Response(JSON.stringify({ error: "Unknown action" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify(result), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
