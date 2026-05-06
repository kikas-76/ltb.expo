export type HandoverEventType = 'handover' | 'return';

export interface HandoverModalProps {
  visible: boolean;
  onClose: () => void;
  bookingId: string;
  eventType: HandoverEventType;
  onSuccess?: () => void;
}

export interface IssueTokenResult {
  success?: boolean;
  error?: string;
  id?: string;
  event_type?: HandoverEventType;
  token?: string;
  numeric_code?: string;
  expires_at?: string;
}

export interface RedeemTokenResult {
  success?: boolean;
  error?: string;
  event_type?: HandoverEventType;
  new_status?: string;
}

export const APP_URL =
  process.env.EXPO_PUBLIC_APP_URL ?? 'https://app.louetonbien.fr';

// Build the deep link encoded inside the QR. The scanner accepts either
// the full URL (which the OS scanner can open directly to the app) or the
// raw token as a fallback.
export function buildHandoverUrl(bookingId: string, token: string): string {
  return `${APP_URL}/handover/${bookingId}?t=${token}`;
}

// Extract the token from whatever the scanner read. We accept:
//   - the full URL with ?t=...
//   - the raw long token
//   - a 6-digit numeric code
export function extractScannedToken(raw: string): string {
  if (!raw) return '';
  const trimmed = raw.trim();
  if (trimmed.includes('t=')) {
    try {
      const u = new URL(trimmed);
      const t = u.searchParams.get('t');
      if (t) return t;
    } catch {
      // fall through
    }
  }
  return trimmed;
}
