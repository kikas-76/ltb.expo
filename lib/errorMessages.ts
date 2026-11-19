// Messages d'erreur affichés à l'utilisateur : toujours en français.
//
// Supabase (Auth, base de données), Stripe et le navigateur répondent en
// anglais ; nos fonctions SQL et serveur répondent le plus souvent en français.
// frenchError() traduit ce qu'il reconnaît, laisse passer un message déjà en
// français et remplace le reste par le message de repli (jamais d'anglais brut).

export const GENERIC_ERROR = 'Une erreur est survenue. Réessayez dans un instant.';
export const NETWORK_ERROR = 'Connexion impossible. Vérifiez votre connexion internet et réessayez.';
export const SESSION_ERROR = 'Votre session a expiré. Reconnectez-vous puis réessayez.';
export const PERMISSION_ERROR = "Vous n'avez pas l'autorisation d'effectuer cette action.";
const RATE_LIMIT_ERROR = 'Trop de tentatives. Patientez quelques minutes avant de réessayer.';
const EMAIL_RATE_LIMIT_ERROR = "Trop d'e-mails envoyés à cette adresse. Patientez quelques minutes avant de réessayer.";
const LINK_EXPIRED_ERROR = 'Ce lien a expiré ou a déjà été utilisé. Demandez-en un nouveau.';
const WEAK_PASSWORD_ERROR = 'Mot de passe trop faible : 6 caractères minimum, dont une minuscule, une majuscule et un chiffre.';

// Codes d'erreur de Supabase Auth (error.code).
const AUTH_CODES: Record<string, string> = {
  invalid_credentials: 'E-mail ou mot de passe incorrect.',
  email_not_confirmed: "Votre adresse e-mail n'est pas encore confirmée. Ouvrez le lien reçu par e-mail.",
  user_already_exists: 'Un compte existe déjà avec cette adresse e-mail.',
  email_exists: 'Un compte existe déjà avec cette adresse e-mail.',
  identity_already_exists: 'Ce compte est déjà lié à un autre compte LoueTonBien.',
  email_address_invalid: 'Adresse e-mail invalide.',
  email_address_not_authorized: "Impossible d'envoyer un e-mail à cette adresse. Utilisez-en une autre.",
  weak_password: WEAK_PASSWORD_ERROR,
  same_password: "Le nouveau mot de passe doit être différent de l'ancien.",
  over_email_send_rate_limit: EMAIL_RATE_LIMIT_ERROR,
  over_request_rate_limit: RATE_LIMIT_ERROR,
  over_sms_send_rate_limit: RATE_LIMIT_ERROR,
  otp_expired: LINK_EXPIRED_ERROR,
  flow_state_expired: LINK_EXPIRED_ERROR,
  flow_state_not_found: LINK_EXPIRED_ERROR,
  bad_code_verifier: LINK_EXPIRED_ERROR,
  bad_oauth_state: 'La connexion a été interrompue. Réessayez.',
  bad_oauth_callback: 'La connexion a été interrompue. Réessayez.',
  session_not_found: SESSION_ERROR,
  session_expired: SESSION_ERROR,
  refresh_token_not_found: SESSION_ERROR,
  refresh_token_already_used: SESSION_ERROR,
  bad_jwt: SESSION_ERROR,
  no_authorization: SESSION_ERROR,
  reauthentication_needed: 'Par sécurité, reconnectez-vous puis réessayez.',
  reauthentication_not_valid: 'Code de vérification incorrect.',
  user_not_found: 'Aucun compte ne correspond à cette adresse e-mail.',
  user_banned: 'Ce compte est suspendu. Contactez admin@louetonbien.fr.',
  signup_disabled: 'Les inscriptions sont momentanément fermées.',
  provider_disabled: 'Ce mode de connexion est indisponible pour le moment.',
  email_provider_disabled: 'La connexion par e-mail est indisponible pour le moment.',
  oauth_provider_not_supported: 'Ce mode de connexion est indisponible pour le moment.',
  manual_linking_disabled: 'La liaison de comptes est indisponible pour le moment.',
  single_identity_not_deletable: 'Ce mode de connexion est le seul de votre compte : il ne peut pas être retiré.',
  captcha_failed: 'La vérification anti-robot a échoué. Réessayez.',
  validation_failed: 'Informations invalides. Vérifiez les champs et réessayez.',
  request_timeout: 'Le serveur met trop de temps à répondre. Réessayez.',
  conflict: 'Une autre opération est en cours. Réessayez dans un instant.',
};

// Codes PostgreSQL / PostgREST (error.code) sans message français.
const DB_CODES: Record<string, string> = {
  '42501': PERMISSION_ERROR,
  '23505': 'Cette information est déjà utilisée.',
  '23514': "Une des valeurs saisies n'est pas valide.",
  '22P02': "Une des valeurs saisies n'est pas valide.",
  '23502': 'Un champ obligatoire est manquant.',
  '22001': 'Un des textes saisis est trop long.',
  '23503': "Cet élément n'existe plus.",
  '57014': 'Le serveur met trop de temps à répondre. Réessayez.',
  PGRST116: 'Élément introuvable.',
  PGRST301: SESSION_ERROR,
  PGRST303: SESSION_ERROR,
};

// Messages anglais connus (Supabase, navigateur, nos fonctions serveur).
const PATTERNS: [RegExp, string | ((m: RegExpMatchArray) => string)][] = [
  // Réseau
  [/failed to fetch|network ?request failed|load failed|networkerror|network error|fetch failed|failed to send a request|internet connection appears to be offline|err_network|err_internet|econn|etimedout/i, NETWORK_ERROR],
  [/timed? ?out|timeout|aborterror|the operation was aborted/i, 'Le serveur met trop de temps à répondre. Réessayez.'],
  [/unexpected token|json parse error|not valid json|unexpected end of json|unexpected character/i, 'Réponse inattendue du serveur. Réessayez dans un instant.'],

  // Réservations (create_booking_for_payment, update_booking_status)
  [/start_date cannot be in the past/i, 'Ces dates sont déjà passées. Choisissez de nouvelles dates.'],
  [/end_date must be strictly after|duration must be at least/i, 'La date de fin doit être au moins un jour après la date de début.'],
  [/overlap/i, 'Ces dates sont déjà réservées sur cette annonce.'],
  [/listing is not active/i, "Cette annonce n'est plus disponible."],
  [/listing not found/i, "Cette annonce n'existe plus."],
  [/listing price is invalid/i, "Le prix de cette annonce n'est pas valide. Contactez le propriétaire."],
  [/renter cannot be the listing owner/i, 'Vous ne pouvez pas louer votre propre annonce.'],
  [/quantity must be at least/i, 'Choisissez au moins une unité.'],
  [/conversation not found|conversation does not match/i, 'Conversation introuvable.'],
  [/booking not found/i, 'Réservation introuvable.'],
  [/must confirm handover/i, 'Le propriétaire et le locataire doivent tous deux confirmer la remise.'],
  [/must confirm return/i, 'Le propriétaire et le locataire doivent tous deux confirmer le retour.'],
  [/transition not allowed|field not allowed/i, "Cette action n'est plus possible pour cette réservation."],

  // Signalements
  [/report rate limit/i, 'Vous avez atteint la limite de 10 signalements par jour.'],
  [/cannot report yourself/i, 'Vous ne pouvez pas vous signaler vous-même.'],
  [/reported \w+ does not exist/i, "L'élément signalé n'existe plus."],

  // Supabase Auth (anciens messages sans code)
  [/invalid login credentials/i, AUTH_CODES.invalid_credentials],
  [/email not confirmed/i, AUTH_CODES.email_not_confirmed],
  [/user already registered|already been registered|email address already/i, AUTH_CODES.user_already_exists],
  [/identity is already linked/i, AUTH_CODES.identity_already_exists],
  [/known to be weak|easy to guess|pwned/i, 'Ce mot de passe est trop courant. Choisissez-en un autre.'],
  [/password should|password must|signup requires a valid password/i, WEAK_PASSWORD_ERROR],
  [/should be different from the old password/i, AUTH_CODES.same_password],
  [/only request this (?:after|once every) (\d+) seconds?/i, (m) => `Par sécurité, patientez ${m[1]} secondes avant de réessayer.`],
  [/email rate limit/i, EMAIL_RATE_LIMIT_ERROR],
  [/rate limit|too many requests/i, RATE_LIMIT_ERROR],
  [/unable to validate email|email address .* is invalid|invalid email/i, AUTH_CODES.email_address_invalid],
  [/signups? not allowed/i, AUTH_CODES.signup_disabled],
  [/token has expired|link is invalid or has expired|otp.*expired/i, LINK_EXPIRED_ERROR],
  [/error sending .*email|error sending confirmation|error sending recovery/i, "L'e-mail n'a pas pu être envoyé. Réessayez dans quelques minutes."],
  [/provider is not enabled|unsupported provider/i, AUTH_CODES.provider_disabled],
  [/user is banned/i, AUTH_CODES.user_banned],

  // Session / droits (Supabase, passerelle des fonctions, nos fonctions)
  [/auth session missing|refresh token|invalid jwt|jwt expired|missing authorization|not authenticated|authentication required|unauthorized|session expired/i, SESSION_ERROR],
  [/row-level security|permission denied|forbidden|admin only|access denied|not a participant|not a counterparty|owner mismatch/i, PERMISSION_ERROR],

  // Base de données (messages PostgreSQL sans code transmis)
  [/duplicate key/i, DB_CODES['23505']],
  [/violates check constraint|invalid input syntax/i, DB_CODES['23514']],
  [/violates not-null/i, DB_CODES['23502']],
  [/value too long/i, DB_CODES['22001']],
  [/violates foreign key/i, DB_CODES['23503']],
  [/multiple \(or no\) rows|no rows returned|not found/i, 'Élément introuvable.'],
];

const FRENCH_HINT = /[àâçéèêëîïôûùüÿœ]|\b(le|la|les|des|du|une|est|pas|vous|votre|vos|tu|ton|ta|impossible|invalide|introuvable|requis|manquant|veuillez|merci|erreur|aucun|aucune|connexion|compte|carte|annonce|caution|paiement)\b/i;
const ENGLISH_HINT = /\b(the|is|are|not|cannot|can't|must|should|failed|invalid|unable|please|error|exceeded|already|only|your|you|with|found|missing|denied|required)\b/i;

/** Vrai si le texte ressemble à une phrase française (et non à de l'anglais). */
export function looksFrench(text: string): boolean {
  return FRENCH_HINT.test(text) && !ENGLISH_HINT.test(text);
}

function messageOf(err: unknown): string {
  if (typeof err === 'string') return err;
  const message = (err as { message?: unknown } | null)?.message;
  if (typeof message === 'string') return message;
  const error = (err as { error?: unknown } | null)?.error;
  if (typeof error === 'string') return error;
  return '';
}

function codeOf(err: unknown): string {
  const code = (err as { code?: unknown } | null)?.code;
  return typeof code === 'string' || typeof code === 'number' ? String(code) : '';
}

/**
 * Message à afficher pour une erreur (Supabase, Stripe, fetch, Error, texte) :
 * traduit en français, ou `fallback` si l'erreur n'est pas reconnue.
 */
export function frenchError(err: unknown, fallback: string = GENERIC_ERROR): string {
  const message = messageOf(err).trim();
  const code = codeOf(err);

  // Mot de passe déjà divulgué (Supabase vérifie Have I Been Pwned).
  const reasons = (err as { reasons?: unknown } | null)?.reasons;
  if (code === 'weak_password' && Array.isArray(reasons) && reasons.includes('pwned')) {
    return 'Ce mot de passe est trop courant. Choisissez-en un autre.';
  }
  if (code && AUTH_CODES[code]) return AUTH_CODES[code];

  // Nos fonctions SQL lèvent des messages français (code P0001) : on les garde.
  if (message && looksFrench(message)) return message;
  if (code && DB_CODES[code]) return DB_CODES[code];

  if (message) {
    for (const [re, fr] of PATTERNS) {
      const m = message.match(re);
      if (m) return typeof fr === 'string' ? fr : fr(m);
    }
  }
  return fallback;
}
