import { supabase } from '@/lib/supabase';
import type { Session } from '@supabase/supabase-js';

/**
 * Attend qu'une session soit disponible. Sur natif, la session d'un lien
 * e-mail (confirmation, réinitialisation) est posée par le layout racine
 * APRÈS le montage de l'écran d'arrivée : lire la session une seule fois au
 * montage donnait toujours « Session expirée ». On écoute donc les
 * événements d'auth pendant `timeoutMs` avant de conclure.
 */
export function waitForSession(timeoutMs = 8000): Promise<Session | null> {
  return new Promise((resolve) => {
    let settled = false;
    let subscription: { unsubscribe: () => void } | null = null;
    const finish = (session: Session | null) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      subscription?.unsubscribe();
      resolve(session);
    };
    const timer = setTimeout(() => finish(null), timeoutMs);
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session) finish(session);
    });
    subscription = data.subscription;
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) finish(session);
    }).catch(() => {});
  });
}
