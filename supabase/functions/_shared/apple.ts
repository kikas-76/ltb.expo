// Sign in with Apple côté serveur : client secret (JWT ES256 signé avec la clé
// « Sign in with Apple » du compte développeur), échange du code
// d'autorisation contre un refresh token, et révocation de ce jeton.
//
// Secrets attendus (supabase secrets set …) :
//   APPLE_SIGN_IN_KEY_ID       identifiant de la clé .p8 (Apple Developer → Keys)
//   APPLE_SIGN_IN_PRIVATE_KEY  contenu PEM du fichier .p8 (\n littéraux acceptés)
//   APPLE_SIGN_IN_TEAM_ID      défaut 9BH4837DNF
//   APPLE_SIGN_IN_CLIENT_ID    défaut fr.louetonbien.app (bundle id = audience des jetons natifs)
// Sans clé configurée, les appelants doivent dégrader proprement (login inchangé).

import { SignJWT, importPKCS8 } from "npm:jose@5";

const TEAM_ID = Deno.env.get("APPLE_SIGN_IN_TEAM_ID") ?? "9BH4837DNF";
const KEY_ID = Deno.env.get("APPLE_SIGN_IN_KEY_ID") ?? "";
const PRIVATE_KEY = (Deno.env.get("APPLE_SIGN_IN_PRIVATE_KEY") ?? "").replace(/\\n/g, "\n").trim();
const CLIENT_ID = Deno.env.get("APPLE_SIGN_IN_CLIENT_ID") ?? "fr.louetonbien.app";

export function isAppleSignInConfigured(): boolean {
  return Boolean(KEY_ID && PRIVATE_KEY.includes("PRIVATE KEY"));
}

async function clientSecret(): Promise<string> {
  const key = await importPKCS8(PRIVATE_KEY, "ES256");
  const now = Math.floor(Date.now() / 1000);
  return await new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: KEY_ID })
    .setIssuer(TEAM_ID)
    .setIssuedAt(now)
    .setExpirationTime(now + 3600)
    .setAudience("https://appleid.apple.com")
    .setSubject(CLIENT_ID)
    .sign(key);
}

const FORM = { "Content-Type": "application/x-www-form-urlencoded" };

export async function exchangeAppleAuthorizationCode(code: string): Promise<{ refreshToken: string | null; error?: string }> {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: await clientSecret(),
    code,
    grant_type: "authorization_code",
  });
  const res = await fetch("https://appleid.apple.com/auth/token", { method: "POST", headers: FORM, body });
  const json: any = await res.json().catch(() => ({}));
  if (!res.ok || !json.refresh_token) {
    return { refreshToken: null, error: json.error ? `${json.error}${json.error_description ? ": " + json.error_description : ""}` : `HTTP ${res.status}` };
  }
  return { refreshToken: json.refresh_token as string };
}

export async function revokeAppleRefreshToken(token: string): Promise<boolean> {
  const body = new URLSearchParams({
    client_id: CLIENT_ID,
    client_secret: await clientSecret(),
    token,
    token_type_hint: "refresh_token",
  });
  const res = await fetch("https://appleid.apple.com/auth/revoke", { method: "POST", headers: FORM, body });
  return res.ok;
}
