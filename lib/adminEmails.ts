import { supabase } from './supabase';

// Hydrates emails for a list of profile ids via the admin-only RPC
// `admin_get_profile_emails`. Returns a record keyed by id; ids that are
// not visible (caller is not admin, or id not found) are simply absent.
//
// Background: P1-2 column-level grants revoked SELECT(email) from
// authenticated, so admin pages that previously embedded
// `profiles!fkey(... email)` now have to ask the server explicitly.
export async function fetchAdminProfileEmails(
  ids: Array<string | null | undefined>,
): Promise<Record<string, string | null>> {
  const unique = Array.from(new Set(ids.filter((x): x is string => !!x)));
  if (unique.length === 0) return {};

  const { data, error } = await supabase.rpc('admin_get_profile_emails', {
    p_ids: unique,
  });
  if (error || !data) return {};

  const map: Record<string, string | null> = {};
  for (const row of data as Array<{ id: string; email: string | null }>) {
    map[row.id] = row.email ?? null;
  }
  return map;
}
