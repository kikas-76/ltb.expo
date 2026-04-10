const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL!;
const ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!;

export async function sendEmail(
  to: string,
  template: string,
  data: Record<string, any>
) {
  try {
    const response = await fetch(`${SUPABASE_URL}/functions/v1/send-email`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'apikey': ANON_KEY,
        'Authorization': `Bearer ${ANON_KEY}`,
      },
      body: JSON.stringify({ to, template, data }),
    });
    const result = await response.json();
    if (!response.ok) console.error('Email error:', result);
    return result;
  } catch (err) {
    console.error('sendEmail failed:', err);
  }
}
