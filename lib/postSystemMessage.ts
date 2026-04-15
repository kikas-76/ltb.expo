import { supabase } from './supabase';

export async function postSystemMessage(
  conversation_id: string,
  content: string
): Promise<void> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.access_token) return;

  await fetch(
    `${process.env.EXPO_PUBLIC_SUPABASE_URL}/functions/v1/post-system-message`,
    {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
        'Authorization': `Bearer ${session.access_token}`,
      },
      body: JSON.stringify({ conversation_id, content }),
    }
  );
}
