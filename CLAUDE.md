# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project overview

**LoueTonBien** (`louetonbien`) is a French peer-to-peer rental marketplace app built with Expo (React Native + Web). Users can list objects for rent, book listings, chat, and pay via Stripe Connect. The production URL is `https://app.louetonbien.fr`.

## Commands

```bash
# Start dev server (Expo)
npm run dev

# Build for web (SPA, output to dist/)
npm run build:web

# Type checking
npm run typecheck

# Lint
npm run lint
```

No test suite is present.

## Environment variables

Copy `.env.example` to `.env` and fill in:

```
EXPO_PUBLIC_SUPABASE_URL=
EXPO_PUBLIC_SUPABASE_ANON_KEY=
EXPO_PUBLIC_STRIPE_PUBLISHABLE_KEY=
EXPO_PUBLIC_GOOGLE_MAPS_KEY=
```

## Architecture

### Routing (expo-router file-based)

All screens live in `app/`. The routing structure:
- `app/_layout.tsx` — root layout; wraps the whole tree in `StripeWrapper`, `DeepLinkProvider`, `AuthProvider`, `UnreadProvider`, `FavoritesProvider`. Contains the auth guard logic (`RootNavigator`).
- `app/(tabs)/` — authenticated main navigation (Explorer, Louer, Messages/Reservations, Profil)
- `app/onboarding/` — required flow after first sign-up (profile -> address -> welcome)
- `app/admin/` — admin-only section, gated by `profile.role === 'admin'`
- Dynamic routes: `app/listing/[id].tsx`, `app/chat/[id].tsx`, `app/book/[id].tsx`, etc.

**Auth guard flow** (in `app/_layout.tsx`):
1. No session -> redirect to landing (`/`)
2. Session + `onboarding_completed === false` -> redirect to `/onboarding/profile`
3. Admin route + `role !== 'admin'` -> redirect to `/(tabs)`

**Public routes** (accessible without login): landing, login, register, verify-email, email-confirmed, auth-callback, forgot-password, reset-password, legal, book, link-google-account.

### Platform-specific files

Expo resolves `.native.tsx` over `.tsx` on iOS/Android, and `.web.tsx` over `.tsx` on web:
- `components/StripeWrapper.tsx` — no-op on web (Stripe loads via `<script>` in iframe)
- `components/StripeWrapper.native.tsx` — wraps in `<StripeProvider>` on native
- `app/payment/[booking_id].web.tsx` — Stripe Elements in srcdoc iframe (web)
- `app/payment/[booking_id].tsx` — Stripe native SDK (iOS/Android)
- `app/wallet/onboarding.web.tsx` — Stripe Connect embedded onboarding (web)
- `app/wallet/onboarding.tsx` — redirect fallback for native (real flow uses WebBrowser in wallet.tsx)

### Responsive layout

`hooks/useResponsive.ts` exposes `isMobile / isTablet / isDesktop` based on window width (breakpoints: 768px tablet, 1024px desktop). On tablet/desktop web, `app/(tabs)/_layout.tsx` swaps the bottom tab bar for a collapsible sidebar.

### Backend (Supabase)

- `lib/supabase.ts` — singleton `supabase` client (anon key, used client-side)
- `contexts/AuthContext.tsx` — session, profile, `signIn`, `signInWithGoogle`, `signOut`, `refreshProfile`. Profile fields include `role`, `onboarding_completed`, `is_pro`, `stripe_account_id`.
- `lib/updateBookingStatus.ts` — calls `update_booking_status` RPC (used for all booking state transitions)
- `lib/postSystemMessage.ts` — posts system messages into a booking's chat conversation
- `lib/googleMaps.ts` — Google Maps API calls proxied via the `maps-proxy` Edge Function

**Booking statuses** (CHECK constraint): `pending` -> `accepted` / `refused` -> `pending_payment` -> `active` -> `in_progress` -> `pending_return` -> `pending_owner_validation` -> `completed` (or `disputed` / `cancelled` / `expired`)

**RPC `update_booking_status`** transition matrix:
- Owner: `pending->accepted/refused`, `active->in_progress`, `in_progress->pending_owner_validation/disputed`, `pending_owner_validation->completed/disputed`
- Renter: `accepted->pending_payment`, `active->in_progress`, `in_progress->pending_owner_validation`, `pending_owner_validation->disputed`

**DB column naming** (bookings): `handover_confirmed_owner`, `handover_confirmed_renter`, `return_confirmed_owner`, `return_confirmed_renter` (NOT `owner_handover_confirmed`).

**Listings columns**: `name` (NOT `title`), `price` (NOT `price_per_day`), `is_active` (NOT `status`), `views_count`, `saves_count`.

**`public_profiles` view**: id, username, avatar_url, photo_url, bio, is_pro, business_name, business_type, business_hours, business_address, siren_number, location_data, created_at.

### Supabase Edge Functions (`supabase/functions/`)

All functions are Deno-based and use `SUPABASE_SERVICE_ROLE_KEY` server-side:

| Function | Purpose |
|---|---|
| `create-payment-intent` | Creates Stripe PaymentIntent for rental only (deposit is deferred). Validates owner has `stripe_charges_enabled`. Idempotent (returns existing PI if one exists). |
| `finalize-booking-payment` | Verifies payment with Stripe API (`status=succeeded`, `metadata.booking_id` match) before setting booking to `active`. Idempotent with webhook. Triggers `hold-deposit` for short rentals. |
| `hold-deposit` | Cron (daily): creates off-session manual-capture PI for deposit 2 days before `end_date`. Notifies both parties on success/failure. |
| `manage-deposit` | Release (cancel PI) or capture deposit. Graceful no-PI handling for release. |
| `admin-manage-deposit` | Admin tool to capture/release deposits. Uses `role` check (not `is_admin`). |
| `stripe-webhook` | Handles `payment_intent.succeeded` (rental->active, deposit_hold->authorize), `charge.refunded`, `account.updated`. HMAC-SHA256 signature verification. |
| `create-connect-account` | Onboards owners to Stripe Connect Express. Pre-fills name, phone, address, SIREN from profile. Sets `delay_days: 14` for payouts. |
| `create-account-session` | Returns Stripe Account Session for embedded web onboarding. Pre-fills full address + SIREN for pros. |
| `check-account-status` | Checks `charges_enabled` + `payouts_enabled` + `details_submitted`. Syncs all three to profile. |
| `send-email` | Resend API email delivery. 18 templates. Auth via service_role or `INTERNAL_EDGE_SECRET`. |
| `send-admin-email` | Forwards to `send-email`. |
| `chat-notify` | Sends email notifications on booking accept/reject/dispute. |
| `auto-validate-bookings` | Cron: completes bookings 24h after return confirmation. Releases deposit. Updates audit trail. |
| `expire-stale-pending-payments` | Cron: cancels bookings stuck in `pending_payment` for 30min. |
| `maps-proxy` | Proxies Google Maps API requests to keep the key server-side. |
| `post-system-message` | Inserts system messages in conversations. |
| `admin-action` | Admin moderation (suspend, ban, unban, flag). |
| `get-account-details` | Returns Stripe account balance, payouts, transfers for wallet screen. |
| `get-dashboard-link` | Creates Stripe Connect login link for account owner. |
| `create-checkout-session` | Creates Stripe Checkout sessions (legacy, currently unused in app). |

### Payment flow (Stripe Connect)

LoueTonBien uses Stripe Connect Express with a platform fee model:
- `renter_fee_percent` (default 7%) — charged on top of the rental price to the renter
- `owner_commission_percent` (default 8%) — deducted from the owner's payout
- Owner payouts are delayed 14 days (`settings.payouts.schedule.delay_days: 14`)
- Fee calculations use dynamic values from `listings` table (not hardcoded)

**Deposit (caution) system — deferred hold model:**
1. At payment: only rental is charged. Renter's card is saved via `setup_future_usage: "off_session"`.
2. 2 days before `end_date`: `hold-deposit` cron creates an off-session manual-capture PI.
3. On return validated: owner releases (cancel PI) or disputes (capture PI).
4. If card fails at J-2: `deposit_hold_failed = true`, both parties notified.
5. Short rentals (< 2 days): `finalize-booking-payment` triggers `hold-deposit` immediately.

**Payment security:**
- `finalize-booking-payment` verifies with Stripe API that rental PI `status === succeeded` and `metadata.booking_id` matches before activating booking.
- Web iframe uses `event.source` check (unforgeable) on postMessage.
- `create-payment-intent` requires `ownerStripeAccountId` AND `stripe_charges_enabled`.
- `payment-success.tsx` does NOT set booking to active (webhook/finalize handle it).

### Password reset flow

`forgot-password.tsx` sends reset email with `redirectTo: /reset-password`. `reset-password.tsx` captures recovery tokens from URL hash, sets session, and calls `supabase.auth.updateUser({ password })`.

### Contexts

| Context | File | Purpose |
|---|---|---|
| `AuthContext` | `contexts/AuthContext.tsx` | Session, user, profile, auth methods |
| `FavoritesContext` | `contexts/FavoritesContext.tsx` | Refresh signal for `saved_listings` (persisted in DB via `useFavorite` hook) |
| `UnreadContext` | `contexts/UnreadContext.tsx` | `hasIncomingRequests` + `incomingRequestCount` for badges |
| `DeepLinkContext` | `contexts/DeepLinkContext.tsx` | Deferred deep links (e.g. `/listing/[id]` before login) |

### Design system

- Colors: `constants/colors.ts` — primary green `#7A9060` / dark `#4E6B38`, background `#F5F2E3`
- Fonts: PlusJakartaSans (mapped as `Inter-*`) and Outfit (mapped as `Outfit-*` and `Inter-SemiBold`/`Inter-Bold`)
- Icons: `@expo/vector-icons` (Ionicons) + `lucide-react-native`
