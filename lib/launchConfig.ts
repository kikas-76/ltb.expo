// Soft-launch "deposit only" mode.
// When EXPO_PUBLIC_PRELAUNCH_MODE === 'true' the app allows account
// creation, onboarding, listing creation, wallet/Stripe Connect setup,
// and editing one's own data, but NOT browsing the marketplace, search,
// bookings, payments, chat, or other users' profiles.
//
// To open the marketplace: set EXPO_PUBLIC_PRELAUNCH_MODE=false (or remove
// it) on Vercel and redeploy. No code change needed. Listings deposited
// during the prelaunch stay live.
export const PRELAUNCH_MODE = process.env.EXPO_PUBLIC_PRELAUNCH_MODE === 'true';

// First-segment allowlist for authenticated + onboarded users during
// prelaunch. Anything not in this set is redirected to mes-annonces.
export const PRELAUNCH_ALLOWED_SEGMENTS = new Set<string | undefined>([
  undefined,           // landing '/'
  '+not-found',
  'login',
  'register',
  'verify-email',
  'email-confirmed',
  'auth-callback',
  'forgot-password',
  'reset-password',
  'link-google-account',
  'legal',
  'onboarding',
  'create-listing',
  'wallet',         // routed, but the page itself renders <PreviewUnavailable />
  'favorites',      // same: reachable so we can show the "not yet available" screen
  'account-settings',
  'help-center',
  'help',
]);
