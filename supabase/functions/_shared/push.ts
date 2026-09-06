// Shared Expo Push helper for edge functions.
//
// - Lit les jetons des destinataires dans `push_tokens` et relaie via l'API
//   Expo Push (exp.host). Aucune clé APNs/FCM côté serveur : Expo signe avec
//   la clé chargée via EAS.
// - Écrit systématiquement une ligne dans `notifications` (centre de
//   notifications de l'app) : une notification ratée n'est jamais perdue.
// - Respecte les préférences `profiles.notification_prefs` pour l'envoi push
//   (le centre de notifications, lui, garde tout).
// - Envoie le compteur de non-lus en `badge` (pastille sur l'icône iOS).
// - Les jetons `DeviceNotRegistered` (app désinstallée, jeton renouvelé) sont
//   supprimés.

import type { SupabaseClient } from "npm:@supabase/supabase-js@2";

export type PushCategory = "messages" | "bookings" | "reminders" | "news";

export interface PushMessage {
  title: string;
  body: string;
  data?: Record<string, unknown>;
  /** Identifiant de l'événement (ex. booking_request, new_message). */
  type?: string;
  /** Catégorie pour les préférences utilisateur. Défaut : bookings. */
  category?: PushCategory;
  /** Ne pas écrire dans le centre de notifications (rappels purement push…). */
  skipInbox?: boolean;
}

const DEFAULT_PREFS: Record<PushCategory, boolean> = {
  messages: true,
  bookings: true,
  reminders: true,
  news: true,
};

export async function sendPushToUsers(
  admin: SupabaseClient,
  userIds: string[],
  msg: PushMessage,
): Promise<void> {
  const targets = [...new Set(userIds.filter(Boolean))];
  if (targets.length === 0) return;
  const category: PushCategory = msg.category ?? "bookings";
  const type = msg.type ?? category;

  // 1) Centre de notifications : une ligne par destinataire.
  if (!msg.skipInbox) {
    const rows = targets.map((user_id) => ({
      user_id,
      type,
      title: msg.title,
      body: msg.body,
      data: msg.data ?? {},
    }));
    const { error: insertError } = await admin.from("notifications").insert(rows);
    if (insertError) console.error("notifications insert failed:", insertError.message);
  }

  // 2) Préférences : on n'envoie le push qu'aux utilisateurs qui ont gardé la catégorie.
  const { data: profiles } = await admin
    .from("profiles")
    .select("id, notification_prefs")
    .in("id", targets);
  const allowed = new Set(
    targets.filter((id) => {
      const prefs = (profiles ?? []).find((p: any) => p.id === id)?.notification_prefs ?? {};
      const value = (prefs as Record<string, boolean>)[category];
      return value === undefined ? DEFAULT_PREFS[category] : value !== false;
    }),
  );
  if (allowed.size === 0) return;

  // 3) Compteur de non-lus par destinataire (pastille sur l'icône).
  const badges = new Map<string, number>();
  for (const id of allowed) {
    const { count } = await admin
      .from("notifications")
      .select("id", { count: "exact", head: true })
      .eq("user_id", id)
      .eq("is_read", false);
    badges.set(id, count ?? 0);
  }

  const { data: tokenRows, error } = await admin
    .from("push_tokens")
    .select("token, user_id")
    .in("user_id", [...allowed]);

  if (error || !tokenRows || tokenRows.length === 0) return;

  const messages = tokenRows.map((row) => ({
    to: row.token as string,
    sound: "default",
    title: msg.title,
    body: msg.body,
    badge: badges.get(row.user_id as string) ?? undefined,
    data: { ...(msg.data ?? {}), type },
  }));

  // Expo Push API caps batches at 100 messages.
  for (let i = 0; i < messages.length; i += 100) {
    const chunk = messages.slice(i, i + 100);
    try {
      const res = await fetch("https://exp.host/--/api/v2/push/send", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(chunk),
      });
      const json = await res.json().catch(() => null);
      const tickets = json?.data;
      if (Array.isArray(tickets)) {
        const deadTokens: string[] = [];
        tickets.forEach((ticket: any, idx: number) => {
          if (ticket?.details?.error === "DeviceNotRegistered") {
            deadTokens.push(chunk[idx].to);
          }
        });
        if (deadTokens.length > 0) {
          await admin.from("push_tokens").delete().in("token", deadTokens);
        }
      }
    } catch (err) {
      console.error("expo push send failed:", err);
    }
  }
}

/** Vrai si une notification de ce type existe déjà pour cet objet (anti-doublon des rappels). */
export async function alreadyNotified(
  admin: SupabaseClient,
  userId: string,
  type: string,
  key: string,
): Promise<boolean> {
  const { count } = await admin
    .from("notifications")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId)
    .eq("type", type)
    .contains("data", { key });
  return (count ?? 0) > 0;
}
