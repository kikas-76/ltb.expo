import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { buildCorsHeaders, preflightResponse, type CorsOptions } from "../_shared/cors.ts";

const RESEND_API_KEY = Deno.env.get("RESEND_API_KEY");
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
const INTERNAL_EDGE_SECRET = Deno.env.get("INTERNAL_EDGE_SECRET");

const FROM = "LoueTonBien <noreply@contact.louetonbien.fr>";
const SUPPORT = "admin@louetonbien.fr";
const APP_URL = "https://app.louetonbien.fr";

const corsOpts: CorsOptions = {
  methods: "POST, OPTIONS",
  headers: "authorization, x-client-info, apikey, content-type, x-internal-secret",
};

function jsonResponse(corsHeaders: Record<string, string>, payload: unknown, status = 200) {
  return new Response(JSON.stringify(payload), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}

function escapeHtml(value: unknown): string {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function safeEmail(value: unknown): string {
  return escapeHtml(String(value ?? "").trim());
}

function asText(value: unknown, fallback = ""): string {
  const v = String(value ?? "").trim();
  return escapeHtml(v || fallback);
}

function asNumber(value: unknown, fallback = "0"): string {
  const n = Number(value);
  if (Number.isFinite(n)) return escapeHtml(String(n));
  return escapeHtml(fallback);
}

function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function getAuthorized(req: Request, body: Record<string, any>): boolean {
  const authHeader = req.headers.get("authorization") ?? "";
  const bearer = authHeader.startsWith("Bearer ")
    ? authHeader.slice(7).trim()
    : authHeader.trim();

  const apiKey = req.headers.get("apikey")?.trim() ?? "";
  const internalSecret =
    req.headers.get("x-internal-secret")?.trim() ??
    String(body?.internal_secret ?? "").trim();

  const isServiceRole =
    !!SERVICE_ROLE_KEY &&
    (bearer === SERVICE_ROLE_KEY || apiKey === SERVICE_ROLE_KEY);

  const isInternal =
    !!INTERNAL_EDGE_SECRET && internalSecret === INTERNAL_EDGE_SECRET;

  return isServiceRole || isInternal;
}

function baseLayout(content: string, preheader = ""): string {
  return `<!DOCTYPE html>
<html lang="fr">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta http-equiv="X-UA-Compatible" content="IE=edge" />
  <title>LoueTonBien</title>
</head>
<body style="margin:0; padding:0; background-color:#F6F8FC; font-family:Arial, Helvetica, sans-serif;">
  <div style="display:none;max-height:0;overflow:hidden;font-size:1px;color:#F6F8FC;line-height:1px;">
    ${escapeHtml(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>

  <div style="max-width:560px; margin:0 auto; padding:32px 20px;">
    <div style="background-color:#ffffff; border-radius:18px; padding:36px 32px; box-shadow:0 6px 24px rgba(0,0,0,0.08);">
      <div style="text-align:center; margin-bottom:28px;">
        <div style="display:inline-block; background-color:#ccd5ae; color:#111; font-size:22px; font-weight:700; padding:12px 20px; border-radius:14px;">
          LoueTonBien
        </div>
      </div>

      ${content}

      <div style="border-top:1px solid #E5E7EB; padding-top:20px; margin-top:28px;">
        <p style="margin:0 0 6px; font-size:13px; line-height:1.6; color:#9CA3AF; text-align:center;">
          Des questions ? Écris-nous à
          <a href="mailto:${escapeHtml(SUPPORT)}" style="color:#ccd5ae; text-decoration:none; font-weight:600;">${escapeHtml(SUPPORT)}</a>
        </p>
        <p style="margin:0 0 6px; font-size:12px; color:#D1D5DB; text-align:center;">
          LoueTonBien SAS · SIREN 988 872 081 · Grand-Couronne, France
        </p>
        <p style="margin:0; font-size:12px; color:#D1D5DB; text-align:center;">
          <a href="${APP_URL}/legal" style="color:#9CA3AF; text-decoration:underline;">Mentions légales</a>
        </p>
      </div>
    </div>
  </div>
</body>
</html>`;
}

function heading(text: string): string {
  return `<h2 style="margin:0 0 18px 0; font-size:28px; line-height:1.2; color:#111827; text-align:center;">${text}</h2>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px 0; font-size:16px; line-height:1.6; color:#374151; text-align:center;">${text}</p>`;
}

function smallText(text: string): string {
  return `<p style="margin:0 0 14px 0; font-size:14px; line-height:1.6; color:#6B7280; text-align:center;">${text}</p>`;
}

function mutedText(text: string): string {
  return `<p style="margin:0; font-size:13px; line-height:1.6; color:#9CA3AF; text-align:center;">${text}</p>`;
}

function ctaButton(label: string, url: string): string {
  return `
    <div style="text-align:center; margin:28px 0 24px 0;">
      <a href="${escapeHtml(url)}"
         style="display:inline-block; background-color:#ccd5ae; color:#111; text-decoration:none; font-size:16px; font-weight:700; padding:15px 28px; border-radius:12px;">
        ${escapeHtml(label)}
      </a>
    </div>`;
}

function infoRow(icon: string, label: string, value: string): string {
  return `
    <tr>
      <td style="padding:10px 0; border-bottom:1px solid #F3F4F6;">
        <table width="100%" cellpadding="0" cellspacing="0" border="0">
          <tr>
            <td width="28" style="font-size:16px; vertical-align:middle;">${icon}</td>
            <td style="font-size:14px; color:#6B7280; vertical-align:middle;">${label}</td>
            <td align="right" style="font-size:14px; font-weight:600; color:#111827; vertical-align:middle;">${value}</td>
          </tr>
        </table>
      </td>
    </tr>`;
}

function infoCard(rows: { icon: string; label: string; value: string }[]): string {
  return `
    <table width="100%" cellpadding="0" cellspacing="0" border="0"
           style="background-color:#F9FAFB; border-radius:12px; padding:4px 16px; margin-bottom:20px;">
      ${rows.map((r) => infoRow(r.icon, escapeHtml(r.label), escapeHtml(r.value))).join("")}
    </table>`;
}

function alertBox(text: string, borderColor = "#ccd5ae", bgColor = "#f0f4e8"): string {
  return `
    <div style="background-color:${escapeHtml(bgColor)}; border-left:4px solid ${escapeHtml(borderColor)}; border-radius:0 10px 10px 0; padding:14px 16px; margin-bottom:20px;">
      <p style="margin:0; font-size:14px; color:#374151; line-height:1.6;">${text}</p>
    </div>`;
}

// FIX: removed /(tabs)/ from URLs. Expo-router strips group segments on web
function reservationsUrl() {
  return `${APP_URL}/reservations`;
}

function conversationUrl(d: Record<string, any>) {
  return d.conversation_id ? `${APP_URL}/chat/${encodeURIComponent(String(d.conversation_id))}` : reservationsUrl();
}

function paymentUrl(d: Record<string, any>) {
  return d.booking_id ? `${APP_URL}/payment/${encodeURIComponent(String(d.booking_id))}` : reservationsUrl();
}

function disputeUrl(d: Record<string, any>) {
  return d.dispute_id ? `${APP_URL}/dispute/${encodeURIComponent(String(d.dispute_id))}` : reservationsUrl();
}

type TemplateData = Record<string, any>;

const templates: Record<string, (d: TemplateData) => { subject: string; html: string }> = {
  welcome: (d) => ({
    subject: `Bienvenue sur LoueTonBien, ${asText(d.first_name, "nouvel utilisateur")} !`,
    html: baseLayout(`
      ${heading(`Bienvenue, ${asText(d.first_name, "nouvel utilisateur")} !`)}
      ${paragraph(`Ton compte est créé. Tu peux maintenant louer et proposer des objets près de chez toi.`)}
      ${paragraph(`Avec LoueTonBien, tu rejoins une communauté qui croit en la consommation collaborative. Loue ce dont tu as besoin, propose ce qui prend la poussière.`)}
      ${alertBox(`<strong>Pour commencer :</strong> complète ton profil et ajoute ta première annonce. Les loueurs avec photo de profil reçoivent 3× plus de demandes.`)}
      ${ctaButton("Découvrir l'app →", `${APP_URL}/explore`)}
    `, `Bienvenue dans la communauté LoueTonBien, ${asText(d.first_name, "nouvel utilisateur")} !`)
  }),

  email_verification: (d) => ({
    subject: `Confirme ton adresse email · LoueTonBien`,
    html: baseLayout(`
      ${heading("Confirme ton inscription")}
      ${paragraph(`Bienvenue sur <strong>LoueTonBien</strong>. Pour activer ton compte et commencer à louer ou proposer des objets, confirme ton adresse e-mail.`)}
      ${ctaButton("Confirmer mon e-mail →", String(d.confirmation_url ?? `${APP_URL}/explore`))}
      ${smallText("Si le bouton ne fonctionne pas, copie et colle ce lien :")}
      <p style="margin:0 0 24px 0; font-size:13px; line-height:1.6; word-break:break-all; color:#ccd5ae; text-align:center;">
        ${escapeHtml(String(d.confirmation_url ?? `${APP_URL}/explore`))}
      </p>
      ${mutedText("Si tu n'es pas à l'origine de cette inscription, ignore cet email.")}
    `, "Confirme ton adresse pour activer ton compte LoueTonBien.")
  }),

  reset_password: (d) => ({
    subject: `Réinitialise ton mot de passe · LoueTonBien`,
    html: baseLayout(`
      ${heading("Nouveau mot de passe")}
      ${paragraph("Tu as demandé à réinitialiser ton mot de passe. Clique sur le bouton ci-dessous pour en choisir un nouveau.")}
      ${ctaButton("Choisir un nouveau mot de passe →", String(d.reset_url ?? `${APP_URL}/explore`))}
      ${smallText("Ce lien est valable <strong>1 heure</strong>.")}
      ${alertBox(`<strong>Tu n'as pas fait cette demande ?</strong> Ton compte est peut-être compromis. Change ton mot de passe et contacte-nous à ${escapeHtml(SUPPORT)}.`, "#F59E0B", "#FEF3C7")}
    `, "Réinitialise ton mot de passe LoueTonBien.")
  }),

  booking_request_owner: (d) => ({
    subject: `${asText(d.renter_name, "Un locataire")} veut louer "${asText(d.listing_name, "ton objet")}"`,
    html: baseLayout(`
      ${heading("Nouvelle demande")}
      ${paragraph(`<strong>${asText(d.renter_name, "Un locataire")}</strong> est intéressé par ton annonce.`)}
      ${infoCard([
        { icon: "📦", label: "Objet", value: asText(d.listing_name, "Objet") },
        { icon: "📅", label: "Du", value: asText(d.start_date) },
        { icon: "📅", label: "Au", value: asText(d.end_date) },
        { icon: "⏱️", label: "Durée", value: `${asNumber(d.duration, "0")} jour${Number(d.duration) > 1 ? "s" : ""}` },
        { icon: "💶", label: "Tu recevras", value: `${asNumber(d.owner_earnings)} €` },
        { icon: "🔒", label: "Caution", value: `${asNumber(d.deposit)} €` },
      ])}
      ${d.renter_message ? `
        <div style="background-color:#F9FAFB; border-radius:12px; padding:14px 16px; margin-bottom:20px;">
          <p style="margin:0 0 4px; font-size:12px; color:#9CA3AF; text-transform:uppercase; letter-spacing:1px;">Message de ${asText(d.renter_name, "locataire")}</p>
          <p style="margin:0; font-size:14px; color:#374151; line-height:1.6; font-style:italic;">"${asText(d.renter_message)}"</p>
        </div>` : ""}
      ${alertBox(`<strong>Tu as 24h pour répondre.</strong> Passé ce délai, la demande expire automatiquement.`)}
      ${ctaButton("Voir la demande →", conversationUrl(d))}
    `, `${asText(d.renter_name, "Un locataire")} veut louer "${asText(d.listing_name, "ton objet")}", réponds vite !`)
  }),

  booking_request_renter: (d) => ({
    subject: `Ta demande pour "${asText(d.listing_name, "cet objet")}" a été envoyée`,
    html: baseLayout(`
      ${heading("Demande envoyée !")}
      ${paragraph(`${asText(d.owner_name, "Le propriétaire")} a reçu ta demande et a 24h pour répondre.`)}
      ${infoCard([
        { icon: "📦", label: "Objet", value: asText(d.listing_name, "Objet") },
        { icon: "📅", label: "Du", value: asText(d.start_date) },
        { icon: "📅", label: "Au", value: asText(d.end_date) },
        { icon: "💶", label: "Total estimé", value: `${asNumber(d.total_price)} €` },
        { icon: "🔒", label: "Caution prévue", value: `${asNumber(d.deposit)} €` },
      ])}
      ${smallText("Aucun paiement n'a été effectué. Tu seras débité uniquement si la demande est acceptée.")}
      ${ctaButton("Suivre ma demande →", conversationUrl(d))}
    `, `Ta demande est partie ! ${asText(d.owner_name, "Le propriétaire")} va répondre sous 24h.`)
  }),

  booking_accepted_renter: (d) => ({
    subject: `Demande acceptée · "${asText(d.listing_name, "ta réservation")}"`,
    html: baseLayout(`
      ${heading("C'est accepté !")}
      ${paragraph(`<strong>${asText(d.owner_name, "Le propriétaire")}</strong> a accepté ta demande. Procède au paiement pour confirmer.`)}
      ${infoCard([
        { icon: "📦", label: "Objet", value: asText(d.listing_name, "Objet") },
        { icon: "📅", label: "Du", value: asText(d.start_date) },
        { icon: "📅", label: "Au", value: asText(d.end_date) },
        { icon: "💶", label: "À payer", value: `${asNumber(d.total_price)} €` },
        { icon: "🔒", label: "Caution (non débitée)", value: `${asNumber(d.deposit)} €` },
      ])}
      ${alertBox(`<strong>Paiement requis sous 2h</strong> pour confirmer ta réservation.`)}
      ${ctaButton("Payer maintenant →", paymentUrl(d))}
    `, `${asText(d.owner_name, "Le propriétaire")} a accepté, confirme vite !`)
  }),

  booking_rejected_renter: (d) => ({
    subject: `Demande pour "${asText(d.listing_name, "cet objet")}" · Réponse reçue`,
    html: baseLayout(`
      ${heading("Ta demande n'a pas abouti")}
      ${paragraph(`${asText(d.owner_name, "Le propriétaire")} n'est pas disponible pour cette période. Aucun paiement n'a été effectué.`)}
      ${d.owner_reason ? alertBox(`Message de ${asText(d.owner_name, "Le propriétaire")} : <em>"${asText(d.owner_reason)}"</em>`, "#F59E0B", "#FEF3C7") : ""}
      ${paragraph("Ne t'inquiète pas, il y a sûrement d'autres objets similaires près de chez toi !")}
      ${ctaButton("Chercher un objet similaire →", `${APP_URL}/search`)}
    `, "D'autres options t'attendent sur LoueTonBien.")
  }),

  booking_paid_renter: (d) => ({
    subject: `Paiement confirmé · "${asText(d.listing_name, "ta location")}"`,
    html: baseLayout(`
      ${heading("Réservation confirmée !")}
      ${paragraph("Ton paiement a bien été reçu. La location est active.")}
      ${infoCard([
        { icon: "📦", label: "Objet", value: asText(d.listing_name, "Objet") },
        { icon: "👤", label: "Loueur", value: asText(d.owner_name, "Le propriétaire") },
        { icon: "📅", label: "Du", value: asText(d.start_date) },
        { icon: "📅", label: "Au", value: asText(d.end_date) },
        { icon: "💳", label: "Payé", value: `${asNumber(d.total_price)} €` },
        { icon: "🔒", label: "Caution prévue", value: `${asNumber(d.deposit)} €` },
      ])}
      ${alertBox(`La caution de <strong>${asNumber(d.deposit)} €</strong> sera bloquée sur ta carte <strong>2 jours avant la fin</strong> de la location, puis libérée après le retour en bon état.`)}
      ${ctaButton("Voir ma réservation →", conversationUrl(d))}
    `, `Ta réservation est active · ${asText(d.listing_name, "ton objet")} t'attend !`)
  }),

  booking_paid_owner: (d) => ({
    subject: `Réservation confirmée · "${asText(d.listing_name, "ta location")}"`,
    html: baseLayout(`
      ${heading("C'est parti !")}
      ${paragraph(`<strong>${asText(d.renter_name, "Le locataire")}</strong> a finalisé sa réservation. Tout est confirmé.`)}
      ${infoCard([
        { icon: "📦", label: "Objet", value: asText(d.listing_name, "Objet") },
        { icon: "👤", label: "Locataire", value: asText(d.renter_name, "Le locataire") },
        { icon: "📅", label: "Du", value: asText(d.start_date) },
        { icon: "📅", label: "Au", value: asText(d.end_date) },
        { icon: "💶", label: "Tu recevras", value: `${asNumber(d.owner_earnings)} €` },
      ])}
      ${alertBox(`Le virement sur ton compte sera effectué <strong>14 jours après le paiement</strong>.`)}
      ${ctaButton("Gérer la réservation →", conversationUrl(d))}
    `, `${asText(d.renter_name, "Le locataire")} a confirmé, tout est bon !`)
  }),

  return_reminder: (d) => ({
    subject: `Rappel · Retour de "${asText(d.listing_name, "ta location")}" demain`,
    html: baseLayout(`
      ${heading("Retour demain !")}
      ${paragraph(`Pense à rendre <strong>"${asText(d.listing_name, "cet objet")}"</strong> à ${asText(d.owner_name, "son propriétaire")} avant le ${asText(d.end_date)}.`)}
      ${infoCard([
        { icon: "📦", label: "Objet à rendre", value: asText(d.listing_name, "Objet") },
        { icon: "👤", label: "À rendre à", value: asText(d.owner_name, "Le propriétaire") },
        { icon: "📅", label: "Date limite", value: asText(d.end_date) },
        { icon: "🔒", label: "Caution bloquée", value: `${asNumber(d.deposit)} €` },
      ])}
      ${paragraph(`Une fois l'objet rendu, clique sur "J'ai rendu l'objet" dans l'app pour libérer ta caution.`)}
      ${ctaButton("Confirmer le retour →", conversationUrl(d))}
    `, `N'oublie pas, "${asText(d.listing_name, "cet objet")}" doit être rendu demain !`)
  }),

  deposit_released: (d) => ({
    subject: `Caution libérée · ${asNumber(d.deposit)} € de retour sur ta carte`,
    html: baseLayout(`
      ${heading("Caution libérée !")}
      ${paragraph(`Les <strong>${asNumber(d.deposit)} €</strong> bloqués pour "${asText(d.listing_name, "cette location")}" sont libérés.`)}
      ${paragraph(`Le montant apparaîtra sur ton relevé bancaire sous <strong>5 à 10 jours ouvrés</strong> selon ta banque.`)}
      ${alertBox("La location s'est terminée sans litige. Merci d'avoir pris soin de l'objet !")}
      ${ctaButton("Retour à l'accueil →", `${APP_URL}/explore`)}
    `, `Ta caution de ${asNumber(d.deposit)} € est libérée.`)
  }),

  payout_sent: (d) => ({
    subject: `Virement de ${asNumber(d.amount)} € en route`,
    html: baseLayout(`
      ${heading(`${asNumber(d.amount)} € en chemin !`)}
      ${paragraph(`Ton virement pour la location de "${asText(d.listing_name, "ton objet")}" a été initié.`)}
      ${infoCard([
        { icon: "📦", label: "Objet loué", value: asText(d.listing_name, "Objet") },
        { icon: "👤", label: "Locataire", value: asText(d.renter_name, "Le locataire") },
        { icon: "💶", label: "Montant viré", value: `${asNumber(d.amount)} €` },
        { icon: "🏦", label: "Arrivée estimée", value: "14 jours après le paiement" },
      ])}
      ${ctaButton("Voir mon portefeuille →", `${APP_URL}/wallet`)}
    `, `Ton virement de ${asNumber(d.amount)} € a été initié.`)
  }),

  dispute_opened: (d) => ({
    subject: `Litige ouvert · "${asText(d.listing_name, "ta location")}"`,
    html: baseLayout(`
      ${heading("Un litige a été signalé")}
      ${paragraph(`Un problème a été signalé concernant la location de <strong>"${asText(d.listing_name, "cet objet")}"</strong>.`)}
      ${infoCard([
        { icon: "📦", label: "Objet concerné", value: asText(d.listing_name, "Objet") },
        { icon: "📅", label: "Location", value: `${asText(d.start_date)} → ${asText(d.end_date)}` },
        { icon: "🔒", label: "Caution gelée", value: `${asNumber(d.deposit)} €` },
      ])}
      ${alertBox(`<strong>Prochaine étape :</strong> notre équipe va examiner les preuves soumises. Tu recevras une décision sous <strong>48 heures ouvrées</strong>. La caution reste gelée.`, "#F59E0B", "#FEF3C7")}
      ${paragraph("Si tu as des éléments supplémentaires (photos, messages), ajoute-les dans l'app.")}
      ${ctaButton("Voir le litige →", disputeUrl(d))}
    `, "Notre équipe examine la situation. Décision sous 48h.")
  }),

  dispute_resolved_renter_won: (d) => ({
    subject: `Litige résolu · Caution remboursée`,
    html: baseLayout(`
      ${heading("Litige résolu en ta faveur")}
      ${paragraph(`Après examen, la caution de <strong>${asNumber(d.deposit)} €</strong> te sera intégralement remboursée.`)}
      ${alertBox(`<strong>Décision :</strong> remboursement total de la caution de ${asNumber(d.deposit)} €. Le montant apparaîtra sur ta carte sous 5 à 10 jours ouvrés.`)}
      ${paragraph(`Merci de ta patience. Si tu as des questions, contacte-nous à ${escapeHtml(SUPPORT)}.`)}
      ${ctaButton("Retour à l'accueil →", `${APP_URL}/explore`)}
    `, `Ta caution de ${asNumber(d.deposit)} € va être remboursée.`)
  }),

  dispute_resolved_owner_won: (d) => ({
    subject: `Litige résolu · Dédommagement confirmé`,
    html: baseLayout(`
      ${heading("Litige résolu en ta faveur")}
      ${paragraph(`Après examen des preuves, la caution de <strong>${asNumber(d.deposit)} €</strong> va être capturée.`)}
      ${alertBox(`<strong>Décision :</strong> capture de la caution de ${asNumber(d.deposit)} €. Le montant sera viré sur ton compte selon ton calendrier Stripe.`)}
      ${paragraph("Nous sommes désolés que cette location se soit mal passée.")}
      ${ctaButton("Voir mon portefeuille →", `${APP_URL}/wallet`)}
    `, `La caution de ${asNumber(d.deposit)} € t'est versée.`)
  }),

  dispute_resolved_renter_lost: (d) => ({
    subject: `Litige résolu · La caution est débitée`,
    html: baseLayout(`
      ${heading("Litige résolu")}
      ${paragraph(`Après examen du dossier, la caution de <strong>${asNumber(d.deposit)} €</strong> liée à "${asText(d.listing_name, "cette location")}" sera débitée.`)}
      ${alertBox(`<strong>Décision :</strong> la caution de ${asNumber(d.deposit)} € est attribuée au propriétaire en compensation.` , "#F59E0B", "#FEF3C7")}
      ${paragraph(`Si tu souhaites des précisions, contacte-nous à ${escapeHtml(SUPPORT)}.`)}
      ${ctaButton("Voir mes réservations →", reservationsUrl())}
    `, "Le litige est terminé et la caution est débitée.")
  }),

  booking_cancelled_owner: (d) => ({
    subject: `Annulation · "${asText(d.listing_name, "ton objet")}" est de nouveau disponible`,
    html: baseLayout(`
      ${heading("Réservation annulée")}
      ${paragraph(`<strong>${asText(d.renter_name, "Le locataire")}</strong> a annulé sa réservation pour "${asText(d.listing_name, "ton objet")}".`)}
      ${infoCard([
        { icon: "📦", label: "Objet", value: asText(d.listing_name, "Objet") },
        { icon: "📅", label: "Créneau annulé", value: `${asText(d.start_date)} → ${asText(d.end_date)}` },
      ])}
      ${paragraph("Ton annonce est automatiquement remise en ligne pour ces dates.")}
      ${ctaButton("Voir mes annonces →", `${APP_URL}/mes-annonces`)}
    `, `${asText(d.renter_name, "Le locataire")} a annulé, ton objet est de nouveau disponible.`)
  }),

  stripe_account_activated: (d) => ({
    subject: `Ton compte paiement est actif`,
    html: baseLayout(`
      ${heading("Compte paiement activé !")}
      ${paragraph("Tu peux maintenant recevoir des virements directement sur ton compte bancaire.")}
      ${paragraph("Toutes les locations futures seront automatiquement virées sur ton compte 14 jours après le paiement du locataire.")}
      ${alertBox(`<strong>Prochaine étape :</strong> publie ta première annonce et commence à gagner de l'argent !`)}
      ${ctaButton("Créer une annonce →", `${APP_URL}/create-listing`)}
    `, "Ton compte est prêt, les virements peuvent démarrer !")
  }),

  deposit_hold_created: (d) => ({
    subject: `Caution de ${asNumber(d.deposit)} € bloquée · retour de "${asText(d.listing_name, "ta location")}" bientôt`,
    html: baseLayout(`
      ${heading("Caution bloquée")}
      ${paragraph(`La caution de <strong>${asNumber(d.deposit)} €</strong> pour "${asText(d.listing_name, "ta location")}" a été bloquée sur ta carte en prévision du retour.`)}
      ${alertBox(`Ce montant est <strong>bloqué mais non débité</strong>. Il sera automatiquement libéré après le retour de l'objet en bon état.`)}
      ${ctaButton("Voir ma réservation →", reservationsUrl())}
    `, `Caution de ${asNumber(d.deposit)} € bloquée pour le retour.`)
  }),

  deposit_hold_failed: (d) => ({
    subject: `Action requise · Impossible de bloquer la caution de ${asNumber(d.deposit)} €`,
    html: baseLayout(`
      ${heading("Caution non bloquée")}
      ${paragraph(`Nous n'avons pas pu bloquer la caution de <strong>${asNumber(d.deposit)} €</strong> pour "${asText(d.listing_name, "ta location")}".`)}
      ${alertBox(`<strong>Raison possible :</strong> carte expirée, fonds insuffisants, ou moyen de paiement supprimé. Veuillez mettre à jour votre moyen de paiement.`, "#F59E0B", "#FEF3C7")}
      ${ctaButton("Voir ma réservation →", reservationsUrl())}
    `, `Action requise : la caution de ${asNumber(d.deposit)} € n'a pas pu être bloquée.`)
  }),
};

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return preflightResponse(req, corsOpts);
  }
  const corsHeaders = buildCorsHeaders(req, corsOpts);

  if (req.method !== "POST") {
    return jsonResponse(corsHeaders, { error: "Méthode non autorisée" }, 405);
  }

  if (!RESEND_API_KEY) {
    return jsonResponse(corsHeaders, { error: "RESEND_API_KEY manquant" }, 500);
  }

  try {
    const body = await req.json();

    if (!getAuthorized(req, body)) {
      return jsonResponse(corsHeaders, { error: "Accès non autorisé" }, 403);
    }

    const rawTo = body?.to;
    const template = String(body?.template ?? "").trim();
    const data = body?.data ?? {};

    if (!template || !templates[template]) {
      return jsonResponse(corsHeaders, { error: `Template "${template}" introuvable` }, 400);
    }

    const recipients = Array.isArray(rawTo)
      ? rawTo.map((v) => String(v).trim()).filter(Boolean)
      : [String(rawTo ?? "").trim()].filter(Boolean);

    if (!recipients.length || recipients.some((email) => !isValidEmail(email))) {
      return jsonResponse(corsHeaders, { error: "Destinataire invalide" }, 400);
    }

    const { subject, html } = templates[template](data);

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: FROM,
        to: recipients,
        subject,
        html,
      }),
    });

    const result = await res.json();

    if (!res.ok) {
      // Don't log `result` directly: on Resend failures the response can
      // echo back the full email payload (recipient, subject, HTML body
      // with template variables — names, amounts, etc.). Log only the
      // upstream-provided error metadata.
      const safeError = {
        status: res.status,
        name: typeof result?.name === "string" ? result.name : undefined,
        message: typeof result?.message === "string" ? result.message : undefined,
      };
      console.error("Resend error:", safeError);
      return jsonResponse(corsHeaders, { error: result }, res.status);
    }

    return jsonResponse(corsHeaders, { success: true, id: result.id }, 200);
  } catch (err) {
    console.error("send-email error:", err);
    return jsonResponse(corsHeaders, { error: String(err) }, 500);
  }
});
