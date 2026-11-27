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

// Nombre à la française : « 2 », « 2,14 », « 1 250 » (montants en euros, durées).
function asNumber(value: unknown, fallback = "0"): string {
  const n = Number(value);
  if (!Number.isFinite(n)) return escapeHtml(fallback);
  const r = Math.round(n * 100) / 100;
  const [int, dec] = (Number.isInteger(r) ? String(r) : r.toFixed(2)).split(".");
  const grouped = int.replace(/\B(?=(\d{3})+(?!\d))/g, " ");
  return escapeHtml(dec ? `${grouped},${dec}` : grouped);
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

// ── Charte des emails ───────────────────────────────────────────────────
// Couleurs de l'app (constants/colors.ts). Mise en page en tableaux et
// styles en ligne : c'est ce que Gmail, Outlook et Apple Mail affichent tous.
// En-tête vert foncé + logo blanc : lisible aussi quand la messagerie passe
// en mode sombre (un logo noir sur fond clair y deviendrait invisible).
const C = {
  page: "#F5F2E3",
  card: "#FFFFFF",
  ink: "#2C2C2C",
  body: "#4A4A45",
  muted: "#8A877C",
  hairline: "#ECE8DA",
  panel: "#F8F6EE",
  brand: "#4E6B38",
  brandSoft: "#E8EEE0",
};

type Tone = "brand" | "success" | "info" | "warning" | "danger" | "neutral";

const TONES: Record<Tone, { soft: string; strong: string }> = {
  brand: { soft: "#E8EEE0", strong: "#4E6B38" },
  success: { soft: "#E3F1DC", strong: "#3F6B2A" },
  info: { soft: "#E8F0FB", strong: "#2F5E9E" },
  warning: { soft: "#FCF1D6", strong: "#9A5B07" },
  danger: { soft: "#FBE7E5", strong: "#A3372F" },
  neutral: { soft: "#EFEDE6", strong: "#5F5C53" },
};

const FONT = "'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const FONT_TITLE = "'Outfit', 'Plus Jakarta Sans', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif";
const LOGO_URL = `${APP_URL}/email/logo-blanc.png`;

// Typographie française : espace insécable avant ! ? : ; » € et après «.
function nb(text: string): string {
  return text.replace(/ ([!?:;»€])/g, " $1").replace(/« /g, "« ");
}

const INSTAGRAM_URL = "https://www.instagram.com/louetonbien.fr/";
const LINKEDIN_URL = "https://www.linkedin.com/company/louetonbien";

function baseLayout(
  content: string,
  preheader = "",
  footerNote = "Vous recevez cet email car vous avez un compte LoueTonBien.",
): string {
  return `<!DOCTYPE html>
<html lang="fr" xmlns="http://www.w3.org/1999/xhtml">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="x-apple-disable-message-reformatting" />
  <meta name="color-scheme" content="light only" />
  <meta name="supported-color-schemes" content="light only" />
  <title>LoueTonBien</title>
  <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@600;700&family=Plus+Jakarta+Sans:wght@400;600;700&display=swap" rel="stylesheet" />
  <style>
    :root { color-scheme: light only; supported-color-schemes: light only; }
    body { margin: 0; padding: 0; -webkit-text-size-adjust: 100%; }
    a { color: ${C.brand}; }
    @media (max-width: 600px) {
      .ltb-wrap { padding: 12px 10px 28px !important; }
      .ltb-head { padding: 20px 22px !important; }
      .ltb-card { padding: 28px 22px 26px !important; }
      .ltb-title { font-size: 24px !important; }
      .ltb-btn { width: 100% !important; }
      .ltb-btn a { display: block !important; text-align: center !important; }
    }
  </style>
</head>
<body style="margin:0; padding:0; background-color:${C.page};">
  <div style="display:none; max-height:0; overflow:hidden; opacity:0; font-size:1px; line-height:1px; color:${C.page};">
    ${escapeHtml(preheader)}&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;&nbsp;&zwnj;
  </div>
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="background-color:${C.page};">
    <tr>
      <td align="center" class="ltb-wrap" style="padding:32px 16px 40px;">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="max-width:560px;">
          <tr>
            <td class="ltb-head" bgcolor="${C.brand}" style="background-color:${C.brand}; border-radius:20px 20px 0 0; padding:22px 32px;">
              <a href="${APP_URL}" style="text-decoration:none;">
                <img src="${LOGO_URL}" width="150" alt="LoueTonBien" style="display:block; width:150px; height:auto; border:0; outline:none; color:#FFFFFF; font-family:${FONT}; font-size:22px; font-weight:700;" />
              </a>
            </td>
          </tr>
          <tr>
            <td class="ltb-card" bgcolor="${C.card}" style="background-color:${C.card}; border-radius:0 0 20px 20px; padding:34px 32px 30px;">
              ${content}
            </td>
          </tr>
          <tr>
            <td style="padding:26px 12px 0; text-align:center; font-family:${FONT};">
              <p style="margin:0 0 8px; font-size:13px; line-height:1.6; color:${C.muted};">
                ${nb("Une question ? Écrivez-nous à")} <a href="mailto:${escapeHtml(SUPPORT)}" style="color:${C.brand}; font-weight:700; text-decoration:none;">${escapeHtml(SUPPORT)}</a>
              </p>
              <p style="margin:0 0 14px; font-size:13px; line-height:1.6; color:${C.muted};">
                <a href="${APP_URL}/help-center" style="color:${C.muted}; text-decoration:underline;">Centre d'aide</a>
                &nbsp;·&nbsp;
                <a href="${APP_URL}/legal" style="color:${C.muted}; text-decoration:underline;">Mentions légales</a>
              </p>
              <p style="margin:0 0 16px; font-size:13px; line-height:1.6;">
                <a href="${INSTAGRAM_URL}" style="display:inline-block; margin:0 4px; padding:7px 14px; border-radius:999px; background-color:${C.hairline}; color:${C.brand}; font-weight:700; text-decoration:none;">Instagram</a>
                <a href="${LINKEDIN_URL}" style="display:inline-block; margin:0 4px; padding:7px 14px; border-radius:999px; background-color:${C.hairline}; color:${C.brand}; font-weight:700; text-decoration:none;">LinkedIn</a>
              </p>
              <p style="margin:0 0 4px; font-size:12px; line-height:1.6; color:#A9A595;">LoueTonBien SAS · SIREN 988 872 081 · Grand-Couronne, France</p>
              <p style="margin:0; font-size:12px; line-height:1.6; color:#A9A595;">${escapeHtml(footerNote)}</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;
}

// Étiquette de statut au-dessus du titre (« Paiement confirmé »…).
function eyebrow(text: string, tone: Tone = "brand"): string {
  const t = TONES[tone];
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 14px;">
      <tr>
        <td style="background-color:${t.soft}; border-radius:999px; padding:6px 12px; font-family:${FONT}; font-size:12px; line-height:16px; font-weight:700; letter-spacing:0.2px; color:${t.strong};">${nb(text)}</td>
      </tr>
    </table>`;
}

function heading(text: string): string {
  return `<h1 class="ltb-title" style="margin:0 0 12px; font-family:${FONT_TITLE}; font-size:26px; line-height:1.25; font-weight:700; color:${C.ink};">${nb(text)}</h1>`;
}

function paragraph(text: string): string {
  return `<p style="margin:0 0 16px; font-family:${FONT}; font-size:16px; line-height:1.65; color:${C.body};">${nb(text)}</p>`;
}

function smallText(text: string): string {
  return `<p style="margin:0 0 14px; font-family:${FONT}; font-size:14px; line-height:1.6; color:${C.muted};">${nb(text)}</p>`;
}

function mutedText(text: string): string {
  return `<p style="margin:18px 0 0; font-family:${FONT}; font-size:13px; line-height:1.6; color:${C.muted};">${nb(text)}</p>`;
}

// Bouton compatible avec toutes les messageries (cellule colorée + lien).
function ctaButton(label: string, url: string, variant: "primary" | "secondary" = "primary"): string {
  const primary = variant === "primary";
  return `
    <table role="presentation" cellpadding="0" cellspacing="0" border="0" class="ltb-btn" style="margin:26px 0 6px;">
      <tr>
        <td align="center" bgcolor="${primary ? C.brand : C.card}" style="background-color:${primary ? C.brand : C.card}; border-radius:12px;${primary ? "" : ` border:1.5px solid ${C.brand};`}">
          <a href="${escapeHtml(url)}" style="display:inline-block; padding:${primary ? "15px 28px" : "13px 26px"}; font-family:${FONT}; font-size:16px; line-height:20px; font-weight:700; color:${primary ? "#FFFFFF" : C.brand}; text-decoration:none; border-radius:12px;">${nb(escapeHtml(label))}</a>
        </td>
      </tr>
    </table>`;
}

type InfoRow = { label: string; value: string; strong?: boolean };

// Récapitulatif (objet, dates, montants). `strong` met une ligne en valeur.
function infoCard(rows: InfoRow[]): string {
  const cells = rows.map((r, i) => {
    const border = i < rows.length - 1 ? `border-bottom:1px solid ${C.hairline};` : "";
    return `
        <tr>
          <td style="padding:12px 0; ${border} font-family:${FONT}; font-size:14px; line-height:20px; color:${C.muted}; white-space:nowrap;">${nb(escapeHtml(r.label))}</td>
          <td align="right" style="padding:12px 0 12px 16px; ${border} font-family:${FONT}; font-size:${r.strong ? "17px" : "15px"}; line-height:20px; font-weight:700; color:${r.strong ? C.brand : C.ink};">${nb(escapeHtml(r.value))}</td>
        </tr>`;
  }).join("");
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:22px 0; background-color:${C.panel}; border:1px solid ${C.hairline}; border-radius:14px;">
      <tr>
        <td style="padding:4px 18px;">
          <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0">${cells}
          </table>
        </td>
      </tr>
    </table>`;
}

function alertBox(text: string, tone: Tone = "brand"): string {
  const t = TONES[tone];
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
      <tr>
        <td style="background-color:${t.soft}; border-left:4px solid ${t.strong}; border-radius:0 12px 12px 0; padding:14px 16px; font-family:${FONT}; font-size:14px; line-height:1.6; color:#3F3F3A;">${nb(text)}</td>
      </tr>
    </table>`;
}

// Citation d'un membre (message de demande, motif de refus, avis).
function quoteBox(title: string, text: string): string {
  return `
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" border="0" style="margin:0 0 20px;">
      <tr>
        <td style="background-color:${C.card}; border:1px solid ${C.hairline}; border-radius:14px; padding:16px 18px; font-family:${FONT};">
          <p style="margin:0 0 6px; font-size:12px; line-height:16px; font-weight:700; letter-spacing:0.4px; text-transform:uppercase; color:${C.muted};">${nb(title)}</p>
          <p style="margin:0; font-size:15px; line-height:1.6; font-style:italic; color:${C.ink};">${nb(`« ${text} »`)}</p>
        </td>
      </tr>
    </table>`;
}

// Lien de secours sous un bouton (certaines messageries bloquent les boutons).
function linkFallback(url: string): string {
  return `
    ${smallText("Si le bouton ne fonctionne pas, copiez ce lien dans votre navigateur :")}
    <p style="margin:0 0 8px; font-family:${FONT}; font-size:13px; line-height:1.6; word-break:break-all; color:${C.brand};">${escapeHtml(url)}</p>`;
}

function stars(rating: unknown): string {
  const n = Math.max(1, Math.min(5, Math.round(Number(rating) || 1)));
  return `<span style="color:#D99A00; font-size:22px; letter-spacing:2px;">${"★".repeat(n)}</span><span style="color:#E2DED0; font-size:22px; letter-spacing:2px;">${"★".repeat(5 - n)}</span>`;
}

// Ligne « caution » du récapitulatif, seulement s'il y a une caution.
function depositRow(d: Record<string, any>, label: string): InfoRow[] {
  return Number(d.deposit) > 0 ? [{ label, value: `${asNumber(d.deposit)} €` }] : [];
}

// Objet et texte d'aperçu : texte brut (pas d'échappement HTML, sinon une
// annonce « L'aspirateur » arrivait en « L&#39;aspirateur »).
function plain(value: unknown, fallback = ""): string {
  return String(value ?? "").replace(/\s+/g, " ").trim() || fallback;
}

function subjectLine(text: string): string {
  return nb(text);
}

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
    subject: subjectLine(`Bienvenue sur LoueTonBien, ${plain(d.first_name, "et bienvenue")} !`),
    html: baseLayout(`
      ${eyebrow("Bienvenue")}
      ${heading(`Bienvenue, ${asText(d.first_name, "et merci")} !`)}
      ${paragraph("Votre compte est créé. Vous pouvez maintenant louer et proposer des objets près de chez vous.")}
      ${paragraph("Avec LoueTonBien, vous rejoignez des voisins qui partagent plutôt que d'acheter : louez ce dont vous avez besoin, proposez ce qui dort dans vos placards.")}
      ${alertBox("<strong>Pour bien commencer :</strong> complétez votre profil et publiez votre première annonce. Une photo de profil inspire confiance aux autres membres.")}
      ${ctaButton("Découvrir les annonces", APP_URL)}
    `, nb(`Bienvenue sur LoueTonBien, ${plain(d.first_name, "et merci de nous rejoindre")} !`)),
  }),

  email_verification: (d) => {
    const url = String(d.confirmation_url ?? APP_URL);
    return {
      subject: subjectLine("Confirmez votre adresse email · LoueTonBien"),
      html: baseLayout(`
        ${eyebrow("Inscription")}
        ${heading("Confirmez votre adresse email")}
        ${paragraph("Bienvenue sur <strong>LoueTonBien</strong>. Pour activer votre compte et commencer à louer ou proposer des objets, confirmez votre adresse email.")}
        ${ctaButton("Confirmer mon adresse email", url)}
        ${linkFallback(url)}
        ${mutedText("Si vous n'êtes pas à l'origine de cette inscription, ignorez simplement cet email.")}
      `, nb("Confirmez votre adresse pour activer votre compte LoueTonBien."), "Vous recevez cet email suite à votre inscription sur LoueTonBien."),
    };
  },

  reset_password: (d) => {
    const url = String(d.reset_url ?? APP_URL);
    return {
      subject: subjectLine("Réinitialisez votre mot de passe · LoueTonBien"),
      html: baseLayout(`
        ${eyebrow("Mot de passe")}
        ${heading("Choisissez un nouveau mot de passe")}
        ${paragraph("Vous avez demandé à réinitialiser votre mot de passe. Choisissez-en un nouveau avec le bouton ci-dessous.")}
        ${ctaButton("Choisir un nouveau mot de passe", url)}
        ${linkFallback(url)}
        ${smallText("Ce lien est valable <strong>1 heure</strong>.")}
        ${alertBox(`<strong>Vous n'êtes pas à l'origine de cette demande ?</strong> Ignorez cet email : votre mot de passe reste inchangé. En cas de doute, écrivez-nous à ${escapeHtml(SUPPORT)}.`, "warning")}
      `, nb("Réinitialisez votre mot de passe LoueTonBien.")),
    };
  },

  booking_request_owner: (d) => ({
    subject: subjectLine(`${plain(d.renter_name, "Un membre")} souhaite louer « ${plain(d.listing_name, "votre objet")} »`),
    html: baseLayout(`
      ${eyebrow("Nouvelle demande")}
      ${heading(`${asText(d.renter_name, "Un membre")} souhaite louer votre objet`)}
      ${paragraph("Vous avez reçu une demande de location. Acceptez-la ou refusez-la depuis la conversation.")}
      ${infoCard([
        { label: "Objet", value: plain(d.listing_name, "Objet") },
        { label: "Du", value: plain(d.start_date) },
        { label: "Au", value: plain(d.end_date) },
        { label: "Durée", value: `${asNumber(d.duration, "1")} jour${Number(d.duration) > 1 ? "s" : ""}` },
        { label: "Vous recevrez", value: `${asNumber(d.owner_earnings)} €`, strong: true },
        ...depositRow(d, "Caution"),
      ])}
      ${d.renter_message ? quoteBox(`Message de ${asText(d.renter_name, "votre locataire")}`, asText(d.renter_message)) : ""}
      ${alertBox("<strong>Vous avez 48 h pour répondre.</strong> Passé ce délai, la demande expire automatiquement.")}
      ${ctaButton("Répondre à la demande", conversationUrl(d))}
    `, nb(`${plain(d.renter_name, "Un membre")} souhaite louer « ${plain(d.listing_name, "votre objet")} ». Répondez sous 48 h.`)),
  }),

  booking_request_renter: (d) => ({
    subject: subjectLine(`Votre demande pour « ${plain(d.listing_name, "cet objet")} » est envoyée`),
    html: baseLayout(`
      ${eyebrow("Demande envoyée")}
      ${heading("Votre demande est partie")}
      ${paragraph(`${asText(d.owner_name, "Le propriétaire")} a reçu votre demande et a 48 h pour vous répondre.`)}
      ${infoCard([
        { label: "Objet", value: plain(d.listing_name, "Objet") },
        { label: "Du", value: plain(d.start_date) },
        { label: "Au", value: plain(d.end_date) },
        { label: "Total estimé", value: `${asNumber(d.amount_to_pay ?? d.total_price)} €`, strong: true },
        ...depositRow(d, "Caution prévue"),
      ])}
      ${smallText("Aucun paiement n'a été effectué. Vous ne serez débité qu'après l'accord du propriétaire, quand vous réglerez la location.")}
      ${ctaButton("Suivre ma demande", conversationUrl(d))}
    `, nb(`${plain(d.owner_name, "Le propriétaire")} va vous répondre sous 48 h.`)),
  }),

  booking_accepted_renter: (d) => ({
    subject: subjectLine(`Demande acceptée · « ${plain(d.listing_name, "votre location")} »`),
    html: baseLayout(`
      ${eyebrow("Demande acceptée", "success")}
      ${heading("C'est accepté !")}
      ${paragraph(`<strong>${asText(d.owner_name, "Le propriétaire")}</strong> a accepté votre demande. Réglez la location pour la confirmer.`)}
      ${infoCard([
        { label: "Objet", value: plain(d.listing_name, "Objet") },
        { label: "Du", value: plain(d.start_date) },
        { label: "Au", value: plain(d.end_date) },
        { label: "À payer", value: `${asNumber(d.amount_to_pay ?? d.total_price)} €`, strong: true },
        ...depositRow(d, "Caution (non débitée)"),
      ])}
      ${alertBox("Le paiement se fait dans l'app, depuis la conversation. Une fois lancé, vous avez <strong>2 heures</strong> pour le terminer.")}
      ${ctaButton("Payer maintenant", d.booking_id ? paymentUrl(d) : conversationUrl(d))}
    `, nb(`${plain(d.owner_name, "Le propriétaire")} a accepté votre demande : réglez la location pour la confirmer.`)),
  }),

  booking_rejected_renter: (d) => ({
    subject: subjectLine(`Votre demande pour « ${plain(d.listing_name, "cet objet")} »`),
    html: baseLayout(`
      ${eyebrow("Demande non retenue", "neutral")}
      ${heading("Votre demande n'a pas abouti")}
      ${paragraph(`${asText(d.owner_name, "Le propriétaire")} n'est pas disponible à ces dates. Aucun paiement n'a été effectué.`)}
      ${d.owner_reason ? quoteBox(`Message de ${asText(d.owner_name, "le propriétaire")}`, asText(d.owner_reason)) : ""}
      ${paragraph("D'autres objets similaires sont sûrement disponibles près de chez vous.")}
      ${ctaButton("Chercher un objet similaire", `${APP_URL}/search`)}
    `, nb("D'autres objets vous attendent sur LoueTonBien.")),
  }),

  booking_paid_renter: (d) => ({
    subject: subjectLine(`Paiement confirmé · « ${plain(d.listing_name, "votre location")} »`),
    html: baseLayout(`
      ${eyebrow("Paiement confirmé", "success")}
      ${heading("Votre location est confirmée")}
      ${paragraph("Votre paiement a bien été reçu. Convenez de la remise de l'objet avec le propriétaire dans la conversation.")}
      ${infoCard([
        { label: "Objet", value: plain(d.listing_name, "Objet") },
        { label: "Propriétaire", value: plain(d.owner_name, "Le propriétaire") },
        { label: "Du", value: plain(d.start_date) },
        { label: "Au", value: plain(d.end_date) },
        { label: "Payé", value: `${asNumber(d.amount_paid ?? d.total_price)} €`, strong: true },
        ...depositRow(d, d.deposit_now ? "Caution bloquée" : "Caution prévue"),
      ])}
      ${Number(d.deposit) > 0
        ? alertBox(d.deposit_now
          ? `La caution de <strong>${asNumber(d.deposit)} €</strong> est bloquée sur votre carte <strong>dès maintenant</strong> (location de moins de 2 jours). Elle sera libérée après le retour de l'objet en bon état.`
          : `La caution de <strong>${asNumber(d.deposit)} €</strong> sera bloquée sur votre carte <strong>2 jours avant la fin</strong> de la location, puis libérée après le retour de l'objet en bon état.`)
        : ""}
      ${ctaButton("Voir ma réservation", conversationUrl(d))}
    `, nb(`Votre location de « ${plain(d.listing_name, "votre objet")} » est confirmée.`)),
  }),

  booking_paid_owner: (d) => ({
    subject: subjectLine(`Réservation confirmée · « ${plain(d.listing_name, "votre objet")} »`),
    html: baseLayout(`
      ${eyebrow("Réservation payée", "success")}
      ${heading("Votre objet est réservé")}
      ${paragraph(`<strong>${asText(d.renter_name, "Le locataire")}</strong> a payé la location. Convenez de la remise de l'objet dans la conversation.`)}
      ${infoCard([
        { label: "Objet", value: plain(d.listing_name, "Objet") },
        { label: "Locataire", value: plain(d.renter_name, "Le locataire") },
        { label: "Du", value: plain(d.start_date) },
        { label: "Au", value: plain(d.end_date) },
        { label: "Vous recevrez", value: `${asNumber(d.owner_earnings)} €`, strong: true },
      ])}
      ${alertBox("Le virement sur votre compte bancaire est effectué <strong>14 jours après le paiement</strong>.")}
      ${ctaButton("Voir la réservation", conversationUrl(d))}
    `, nb(`${plain(d.renter_name, "Le locataire")} a payé la location de « ${plain(d.listing_name, "votre objet")} ».`)),
  }),

  return_reminder: (d) => ({
    subject: subjectLine(`Rappel · retour de « ${plain(d.listing_name, "votre location")} » demain`),
    html: baseLayout(`
      ${eyebrow("Rappel", "info")}
      ${heading("Retour prévu demain")}
      ${paragraph(`Pensez à rendre <strong>« ${asText(d.listing_name, "l'objet")} »</strong> à ${asText(d.owner_name, "son propriétaire")} avant le ${asText(d.end_date)}.`)}
      ${infoCard([
        { label: "Objet à rendre", value: plain(d.listing_name, "Objet") },
        { label: "À rendre à", value: plain(d.owner_name, "Le propriétaire") },
        { label: "Date limite", value: plain(d.end_date), strong: true },
        ...depositRow(d, "Caution bloquée"),
      ])}
      ${paragraph("Une fois l'objet rendu, confirmez le retour dans l'app pour libérer votre caution.")}
      ${ctaButton("Confirmer le retour", conversationUrl(d))}
    `, nb(`N'oubliez pas : « ${plain(d.listing_name, "l'objet")} » est à rendre demain.`)),
  }),

  deposit_released: (d) => ({
    subject: subjectLine(`Caution libérée · ${asNumber(d.deposit)} € de retour sur votre carte`),
    html: baseLayout(`
      ${eyebrow("Caution libérée", "success")}
      ${heading("Votre caution est libérée")}
      ${paragraph(`Les <strong>${asNumber(d.deposit)} €</strong> bloqués pour « ${asText(d.listing_name, "cette location")} » sont libérés.`)}
      ${paragraph("Le montant réapparaît sur votre compte sous <strong>5 à 10 jours ouvrés</strong>, selon votre banque.")}
      ${alertBox("La location s'est terminée sans litige. Merci d'avoir pris soin de l'objet !", "success")}
      ${ctaButton("Retour à l'accueil", APP_URL)}
    `, nb(`Votre caution de ${asNumber(d.deposit)} € est libérée.`)),
  }),

  payout_sent: (d) => ({
    subject: subjectLine(`Virement de ${asNumber(d.amount)} € en route`),
    html: baseLayout(`
      ${eyebrow("Virement envoyé", "success")}
      ${heading(`${asNumber(d.amount)} € en route vers votre compte`)}
      ${paragraph(`Le virement pour la location de « ${asText(d.listing_name, "votre objet")} » a été lancé.`)}
      ${infoCard([
        { label: "Objet loué", value: plain(d.listing_name, "Objet") },
        { label: "Locataire", value: plain(d.renter_name, "Le locataire") },
        { label: "Montant viré", value: `${asNumber(d.amount)} €`, strong: true },
      ])}
      ${smallText("Le délai d'arrivée dépend de votre banque : en général quelques jours ouvrés.")}
      ${ctaButton("Voir mon portefeuille", `${APP_URL}/wallet`)}
    `, nb(`Votre virement de ${asNumber(d.amount)} € est en route.`)),
  }),

  // Envoyé à J+1 par la tâche review-reminder aux participants d'une location
  // terminée qui n'ont pas encore laissé d'avis (locataire et propriétaire).
  review_reminder: (d) => ({
    subject: subjectLine(`Comment s'est passée votre location de « ${plain(d.listing_name, "cet objet")} » ?`),
    html: baseLayout(`
      ${eyebrow("Votre avis compte")}
      ${heading("Donnez votre avis")}
      ${paragraph(`Votre location de <strong>« ${asText(d.listing_name, "cet objet")} »</strong> est terminée. Votre avis aide la communauté à louer en confiance.`)}
      ${alertBox("<strong>2 minutes suffisent :</strong> une note de 1 à 5 étoiles et un commentaire si vous le souhaitez. Vous pourrez modifier votre avis pendant 7 jours.")}
      ${ctaButton("Donner mon avis", `${APP_URL}/review/${encodeURIComponent(plain(d.booking_id))}`)}
      ${d.owner_is_pro && d.owner_id ? `
        ${paragraph(`Envie de recommencer ? <strong>@${asText(d.owner_username, "ce professionnel")}</strong> propose d'autres objets à louer.`)}
        ${ctaButton(`Voir les objets de @${plain(d.owner_username, "ce professionnel")}`, `${APP_URL}/owner/${encodeURIComponent(plain(d.owner_id))}`, "secondary")}
      ` : ""}
    `, nb("Votre avis aide la communauté LoueTonBien.")),
  }),

  // Envoyé dès que la location passe en « completed » (validation du
  // propriétaire ou validation automatique), au locataire et au propriétaire.
  booking_completed: (d) => ({
    subject: subjectLine(`Location terminée · « ${plain(d.listing_name, "votre location")} »`),
    html: baseLayout(`
      ${eyebrow("Location terminée", "success")}
      ${heading("Location terminée")}
      ${paragraph(`Votre location de <strong>« ${asText(d.listing_name, "cet objet")} »</strong> est terminée et validée.${d.deposit_released ? " La caution a été libérée." : ""}`)}
      ${paragraph("Si vous avez 2 minutes, laissez un avis : cela aide toute la communauté.")}
      ${ctaButton("Donner mon avis", `${APP_URL}/review/${encodeURIComponent(plain(d.booking_id))}`)}
      ${d.owner_is_pro && d.owner_id ? `
        ${paragraph(`<strong>@${asText(d.owner_username, "ce professionnel")}</strong> a d'autres objets à louer.`)}
        ${ctaButton(`Voir les objets de @${plain(d.owner_username, "ce professionnel")}`, `${APP_URL}/owner/${encodeURIComponent(plain(d.owner_id))}`, "secondary")}
      ` : ""}
    `, nb("Merci d'avoir utilisé LoueTonBien.")),
  }),

  // Envoyé juste après la publication d'un avis, à la personne notée.
  review_received: (d) => ({
    subject: subjectLine(`Vous avez reçu un avis ${"★".repeat(Math.max(1, Math.min(5, Math.round(Number(d.rating) || 1))))}`),
    html: baseLayout(`
      ${eyebrow("Nouvel avis")}
      ${heading(`${asText(d.reviewer_name, "Un membre")} vous a laissé un avis`)}
      <p style="margin:0 0 10px;">${stars(d.rating)}</p>
      ${paragraph(`Pour la location de <strong>« ${asText(d.listing_name, "votre objet")} »</strong>.`)}
      ${d.comment ? quoteBox(`Avis de ${asText(d.reviewer_name, "ce membre")}`, asText(d.comment)) : ""}
      ${paragraph("Cet avis s'ajoute à votre note moyenne, visible sur votre profil.")}
      ${ctaButton("Voir mon profil", `${APP_URL}/owner/${encodeURIComponent(plain(d.reviewed_id))}`)}
    `, nb("Votre réputation grandit avec chaque location.")),
  }),

  dispute_opened: (d) => ({
    subject: subjectLine(`Litige ouvert · « ${plain(d.listing_name, "votre location")} »`),
    html: baseLayout(`
      ${eyebrow("Litige", "warning")}
      ${heading("Un litige a été signalé")}
      ${paragraph(`Un problème a été signalé sur la location de <strong>« ${asText(d.listing_name, "cet objet")} »</strong>.`)}
      ${infoCard([
        { label: "Objet concerné", value: plain(d.listing_name, "Objet") },
        { label: "Location", value: `${plain(d.start_date)} → ${plain(d.end_date)}` },
        ...depositRow(d, "Caution gelée"),
      ])}
      ${alertBox("<strong>Prochaine étape :</strong> notre équipe examine les éléments transmis et vous répond sous <strong>48 heures ouvrées</strong>. La caution reste gelée d'ici là.", "warning")}
      ${paragraph("Vous avez d'autres éléments (photos, messages) ? Ajoutez-les depuis l'app.")}
      ${ctaButton("Voir le litige", disputeUrl(d))}
    `, nb("Notre équipe examine la situation et vous répond sous 48 h ouvrées.")),
  }),

  dispute_resolved_renter_won: (d) => ({
    subject: subjectLine("Litige résolu · caution libérée"),
    html: baseLayout(`
      ${eyebrow("Litige résolu", "success")}
      ${heading("Litige résolu en votre faveur")}
      ${paragraph(`Après examen, la caution de <strong>${asNumber(d.deposit)} €</strong> vous est intégralement rendue.`)}
      ${alertBox(`<strong>Décision :</strong> libération totale de la caution de ${asNumber(d.deposit)} €. Le montant réapparaît sur votre carte sous 5 à 10 jours ouvrés.`, "success")}
      ${paragraph(`Merci de votre patience. Pour toute question, écrivez-nous à ${escapeHtml(SUPPORT)}.`)}
      ${ctaButton("Retour à l'accueil", APP_URL)}
    `, nb(`Votre caution de ${asNumber(d.deposit)} € vous est rendue.`)),
  }),

  dispute_resolved_owner_won: (d) => ({
    subject: subjectLine("Litige résolu · dédommagement confirmé"),
    html: baseLayout(`
      ${eyebrow("Litige résolu", "success")}
      ${heading("Litige résolu en votre faveur")}
      ${paragraph(`Après examen des éléments, la caution de <strong>${asNumber(d.deposit)} €</strong> vous est attribuée.`)}
      ${alertBox(`<strong>Décision :</strong> la caution de ${asNumber(d.deposit)} € est prélevée et vous sera versée selon votre calendrier de virements Stripe.`, "success")}
      ${paragraph("Nous sommes désolés que cette location se soit mal passée.")}
      ${ctaButton("Voir mon portefeuille", `${APP_URL}/wallet`)}
    `, nb(`La caution de ${asNumber(d.deposit)} € vous est attribuée.`)),
  }),

  dispute_resolved_renter_lost: (d) => ({
    subject: subjectLine("Litige résolu · caution prélevée"),
    html: baseLayout(`
      ${eyebrow("Litige résolu", "warning")}
      ${heading("Décision sur le litige")}
      ${paragraph(`Après examen du dossier, la caution de <strong>${asNumber(d.deposit)} €</strong> liée à « ${asText(d.listing_name, "cette location")} » est prélevée.`)}
      ${alertBox(`<strong>Décision :</strong> la caution de ${asNumber(d.deposit)} € est attribuée au propriétaire en dédommagement.`, "warning")}
      ${paragraph(`Pour toute précision, écrivez-nous à ${escapeHtml(SUPPORT)}.`)}
      ${ctaButton("Voir mes réservations", reservationsUrl())}
    `, nb("Le litige est clos : la caution est prélevée.")),
  }),

  booking_cancelled_owner: (d) => ({
    subject: subjectLine(`Annulation · « ${plain(d.listing_name, "votre objet")} » est de nouveau disponible`),
    html: baseLayout(`
      ${eyebrow("Réservation annulée", "warning")}
      ${heading("Réservation annulée")}
      ${paragraph(`<strong>${asText(d.renter_name, "Le locataire")}</strong> a annulé sa réservation de « ${asText(d.listing_name, "votre objet")} ».`)}
      ${infoCard([
        { label: "Objet", value: plain(d.listing_name, "Objet") },
        { label: "Dates libérées", value: `${plain(d.start_date)} → ${plain(d.end_date)}` },
      ])}
      ${paragraph("Votre annonce est de nouveau disponible à ces dates.")}
      ${ctaButton("Voir mes annonces", `${APP_URL}/mes-annonces`)}
    `, nb(`${plain(d.renter_name, "Le locataire")} a annulé : votre objet est de nouveau disponible.`)),
  }),

  stripe_account_activated: () => ({
    subject: subjectLine("Votre compte de paiement est actif"),
    html: baseLayout(`
      ${eyebrow("Compte de paiement", "success")}
      ${heading("Votre compte de paiement est actif")}
      ${paragraph("Vous pouvez maintenant recevoir l'argent de vos locations directement sur votre compte bancaire.")}
      ${paragraph("Chaque location vous est versée 14 jours après le paiement du locataire.")}
      ${alertBox("<strong>Prochaine étape :</strong> publiez votre première annonce et commencez à louer vos objets.")}
      ${ctaButton("Publier une annonce", `${APP_URL}/create-listing`)}
    `, nb("Votre compte est prêt : vous pouvez recevoir vos premiers virements.")),
  }),

  // Stripe a désactivé le compte (seuil KYC, justificatif manquant, échéance
  // proche). Le portefeuille affiche un bandeau ; cet email prévient le
  // propriétaire avant qu'un locataire ne bute sur un paiement impossible.
  stripe_account_action_required: (d) => {
    const deadlineRaw = typeof d.deadline === "string" ? d.deadline : null;
    const deadlineLabel = deadlineRaw
      ? new Date(deadlineRaw).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })
      : null;
    return {
      subject: subjectLine("Action requise · votre compte de paiement"),
      html: baseLayout(`
        ${eyebrow("Action requise", "danger")}
        ${heading("Votre compte de paiement a besoin de vous")}
        ${paragraph("Stripe, notre prestataire de paiement, demande des informations supplémentaires pour continuer à traiter vos paiements.")}
        ${alertBox(`<strong>Sans action de votre part${deadlineLabel ? ` avant le ${deadlineLabel}` : ""}, votre compte sera désactivé</strong> et les locataires ne pourront plus vous payer.`, "danger")}
        ${paragraph("Ouvrez votre portefeuille dans l'app pour fournir les justificatifs demandés.")}
        ${ctaButton("Compléter mon compte", `${APP_URL}/wallet`)}
      `, nb(`Stripe a besoin d'informations complémentaires${deadlineLabel ? ` avant le ${deadlineLabel}` : ""}.`)),
    };
  },

  deposit_hold_created: (d) => ({
    subject: subjectLine(`Caution de ${asNumber(d.deposit)} € bloquée · « ${plain(d.listing_name, "votre location")} »`),
    html: baseLayout(`
      ${eyebrow("Caution", "info")}
      ${heading("Caution bloquée")}
      ${paragraph(`La caution de <strong>${asNumber(d.deposit)} €</strong> pour « ${asText(d.listing_name, "votre location")} » a été bloquée sur votre carte en prévision du retour.`)}
      ${alertBox("Ce montant est <strong>bloqué, pas débité</strong>. Il sera libéré automatiquement après le retour de l'objet en bon état.")}
      ${ctaButton("Voir ma réservation", reservationsUrl())}
    `, nb(`Caution de ${asNumber(d.deposit)} € bloquée en prévision du retour.`)),
  }),

  // Envoyé au locataire ET au propriétaire (d.role) : seul le locataire a
  // quelque chose à faire.
  deposit_hold_failed: (d) => d.role === "owner"
    ? {
      subject: subjectLine(`Caution non bloquée · « ${plain(d.listing_name, "votre objet")} »`),
      html: baseLayout(`
        ${eyebrow("Caution non bloquée", "warning")}
        ${heading("La caution n'a pas pu être bloquée")}
        ${paragraph(`La caution de <strong>${asNumber(d.deposit)} €</strong> pour « ${asText(d.listing_name, "votre objet")} » n'a pas pu être bloquée sur la carte du locataire.`)}
        ${alertBox("Le locataire a été prévenu et doit mettre à jour son moyen de paiement. Une nouvelle tentative a lieu automatiquement chaque jour. Vous n'avez rien à faire.", "warning")}
        ${ctaButton("Voir la réservation", reservationsUrl())}
      `, nb("La caution n'a pas pu être bloquée : le locataire a été prévenu.")),
    }
    : {
      subject: subjectLine(`Action requise · caution de ${asNumber(d.deposit)} € non bloquée`),
      html: baseLayout(`
        ${eyebrow("Action requise", "danger")}
        ${heading("La caution n'a pas pu être bloquée")}
        ${paragraph(`Nous n'avons pas pu bloquer la caution de <strong>${asNumber(d.deposit)} €</strong> pour « ${asText(d.listing_name, "votre location")} ».`)}
        ${alertBox("<strong>Causes possibles :</strong> carte expirée, plafond atteint ou moyen de paiement supprimé. Mettez à jour votre moyen de paiement pour que la location puisse se poursuivre.", "danger")}
        ${ctaButton("Voir ma réservation", reservationsUrl())}
      `, nb(`Action requise : la caution de ${asNumber(d.deposit)} € n'a pas pu être bloquée.`)),
    },
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
