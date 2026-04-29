import { supabase } from './supabase';

// All system-message variants the server knows how to render. Keep this
// union in sync with the EventId type in
// supabase/functions/post-system-message/index.ts.
export type SystemMessageEvent =
  | { event: 'request_accepted' }
  | { event: 'request_refused' }
  | { event: 'handover_confirmed_one' }
  | { event: 'handover_confirmed_both' }
  | { event: 'return_confirmed_one' }
  | { event: 'return_confirmed_both' }
  | { event: 'owner_validated_ok' }
  | { event: 'listing_unavailable' }
  | { event: 'dispute_opened' }
  | { event: 'direct_booking_link'; start_date: string; end_date: string }
  | { event: 'new_request'; start_date: string; end_date: string };

export async function postSystemMessage(
  conversation_id: string,
  payload: SystemMessageEvent
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return;

  const { event, ...rest } = payload as SystemMessageEvent & Record<string, unknown>;
  const params = Object.keys(rest).length > 0 ? rest : undefined;

  await fetch(
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/post-system-message`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ conversation_id, event, params }),
    }
  );
}
