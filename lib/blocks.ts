import { supabase } from '@/lib/supabase';

export interface BlockStatus {
  blockedByMe: boolean;
  blockedByThem: boolean;
}

export const NO_BLOCK: BlockStatus = { blockedByMe: false, blockedByThem: false };

/** Statut de blocage entre l'utilisateur connecté et `otherId` (RPC get_block_status). */
export async function getBlockStatus(otherId: string): Promise<BlockStatus> {
  const { data, error } = await supabase.rpc('get_block_status', { p_other: otherId });
  if (error || !data) return NO_BLOCK;
  return { blockedByMe: !!(data as any).blocked_by_me, blockedByThem: !!(data as any).blocked_by_them };
}

export async function blockUser(meId: string, otherId: string): Promise<string | null> {
  const { error } = await supabase
    .from('blocked_users')
    .upsert({ blocker_id: meId, blocked_id: otherId }, { onConflict: 'blocker_id,blocked_id', ignoreDuplicates: true });
  return error ? error.message : null;
}

export async function unblockUser(meId: string, otherId: string): Promise<string | null> {
  const { error } = await supabase.from('blocked_users').delete().eq('blocker_id', meId).eq('blocked_id', otherId);
  return error ? error.message : null;
}

/** Vrai si l'erreur vient d'un trigger de blocage (message envoyé, conversation ou réservation refusée). */
export function isBlockedError(err: unknown): boolean {
  const message = (err as any)?.message;
  return typeof message === 'string' && /bloqu|contacter cet utilisateur|échanger avec cet utilisateur|réserver auprès/i.test(message);
}
