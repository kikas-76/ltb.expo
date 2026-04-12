import "jsr:@supabase/functions-js/edge-runtime.d.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, POST, PUT, DELETE, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey",
};

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const FROM_EMAIL = "noreply@location-entre-belges.be";
const FROM_NAME = "Location Entre Belges";

function renderTemplate(template: string, data: Record<string, any>): { subject: string; html: string } {
  if (template === "account_suspended") {
    const expiresDate = data.banned_until
      ? new Date(data.banned_until).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
      : "dans 30 jours";
    return {
      subject: "Votre compte a été suspendu temporairement",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #f9f9f9;">
          <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
            <h2 style="color: #2c2c2c; margin-bottom: 8px;">Suspension temporaire de votre compte</h2>
            <p style="color: #6b6b6b; font-size: 15px; line-height: 1.6;">
              Bonjour <strong>${data.username}</strong>,
            </p>
            <p style="color: #6b6b6b; font-size: 15px; line-height: 1.6;">
              Votre compte Location Entre Belges a été suspendu temporairement jusqu'au <strong>${expiresDate}</strong>.
            </p>
            ${data.reason ? `<div style="background: #fef3c7; border-left: 4px solid #d97706; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="color: #92400e; margin: 0; font-size: 14px;"><strong>Motif :</strong> ${data.reason}</p>
            </div>` : ""}
            <p style="color: #6b6b6b; font-size: 14px; line-height: 1.6; margin-top: 20px;">
              Pendant cette période, l'accès à votre compte est restreint. Si vous pensez qu'il s'agit d'une erreur, vous pouvez contacter notre équipe de support.
            </p>
            <p style="color: #9b9b9b; font-size: 13px; margin-top: 32px;">L'équipe Location Entre Belges</p>
          </div>
        </div>
      `,
    };
  }

  if (template === "account_banned") {
    return {
      subject: "Votre compte a été désactivé",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #f9f9f9;">
          <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
            <h2 style="color: #c25450; margin-bottom: 8px;">Désactivation de votre compte</h2>
            <p style="color: #6b6b6b; font-size: 15px; line-height: 1.6;">
              Bonjour <strong>${data.username}</strong>,
            </p>
            <p style="color: #6b6b6b; font-size: 15px; line-height: 1.6;">
              Votre compte Location Entre Belges a été désactivé de manière permanente suite à une violation de nos conditions d'utilisation.
            </p>
            ${data.reason ? `<div style="background: #fdecea; border-left: 4px solid #c25450; padding: 16px; border-radius: 8px; margin: 20px 0;">
              <p style="color: #c25450; margin: 0; font-size: 14px;"><strong>Motif :</strong> ${data.reason}</p>
            </div>` : ""}
            <p style="color: #6b6b6b; font-size: 14px; line-height: 1.6; margin-top: 20px;">
              Si vous estimez que cette décision est incorrecte, vous pouvez nous contacter pour contester cette désactivation.
            </p>
            <p style="color: #9b9b9b; font-size: 13px; margin-top: 32px;">L'équipe Location Entre Belges</p>
          </div>
        </div>
      `,
    };
  }

  if (template === "account_reactivated") {
    return {
      subject: "Votre compte a été réactivé",
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 32px; background: #f9f9f9;">
          <div style="background: white; border-radius: 12px; padding: 32px; box-shadow: 0 2px 8px rgba(0,0,0,0.06);">
            <h2 style="color: #8e9878; margin-bottom: 8px;">Votre compte est à nouveau actif</h2>
            <p style="color: #6b6b6b; font-size: 15px; line-height: 1.6;">
              Bonjour <strong>${data.username}</strong>,
            </p>
            <p style="color: #6b6b6b; font-size: 15px; line-height: 1.6;">
              Bonne nouvelle ! Votre compte Location Entre Belges a été réactivé. Vous pouvez à nouveau accéder à toutes les fonctionnalités de la plateforme.
            </p>
            <p style="color: #6b6b6b; font-size: 14px; line-height: 1.6; margin-top: 16px;">
              Merci de respecter nos conditions d'utilisation pour éviter de futures restrictions.
            </p>
            <p style="color: #9b9b9b; font-size: 13px; margin-top: 32px;">L'équipe Location Entre Belges</p>
          </div>
        </div>
      `,
    };
  }

  return {
    subject: "Notification Location Entre Belges",
    html: `<p>Notification de la plateforme Location Entre Belges.</p>`,
  };
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 200, headers: corsHeaders });
  }

  try {
    const { to, template, data } = await req.json();

    if (!to || !template) {
      return new Response(JSON.stringify({ error: "Missing to or template" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { subject, html } = renderTemplate(template, data ?? {});

    if (!RESEND_API_KEY) {
      console.log(`[send-admin-email] No RESEND_API_KEY. Would send to ${to}: ${subject}`);
      return new Response(JSON.stringify({ success: true, simulated: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: `${FROM_NAME} <${FROM_EMAIL}>`,
        to: [to],
        subject,
        html,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      return new Response(JSON.stringify({ error: result }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ success: true, id: result.id }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (err: any) {
    return new Response(JSON.stringify({ error: err.message ?? "Internal error" }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
