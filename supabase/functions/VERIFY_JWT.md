# Edge Function `verify_jwt` settings (audit P1-3)

`verify_jwt` is a per-function flag stored on the Supabase project, not in
this repo. It tells the Edge runtime whether to reject requests that don't
carry a valid Supabase-signed JWT in `Authorization: Bearer <token>`
*before* the function code runs. We track it here so a fresh deploy can
match the production wiring.

If you re-deploy a function via the Supabase MCP, the dashboard, or the
CLI, set the flag to the value shown below.

## User-facing functions — `verify_jwt: true`

These are called from the app with a Supabase user session JWT. Defense in
depth: each function still calls `auth.getUser(token)` internally, but the
pre-handler short-circuits unauthenticated traffic before the Stripe /
Supabase admin clients even spin up.

- `create-connect-account` — Stripe Connect onboarding link
- `check-account-status` — Stripe Connect status pull
- `create-account-session` — Stripe embedded onboarding session
- `create-payment-intent` — rental PaymentIntent
- `finalize-booking-payment` — confirms payment, flips booking to active
- `manage-deposit` — owner releases / admin captures the deposit
- `get-account-details` — wallet dashboard data
- `delete-user-account` — RGPD right to erasure
- `chat-notify` — booking accepted / refused / dispute_opened email triggers
- `post-system-message` — server-authored chat messages
- `send-admin-email` — admin-action wrapper around `send-email`
- `admin-action` — admin moderation (suspend / ban / unban / flag)
- `admin-manage-deposit` — admin capture / release tool
- `get-dashboard-link` — Stripe Connect login link
- `maps-proxy` — Google Maps autocomplete / geocode / staticmap proxy

## Webhook-shaped functions — `verify_jwt: false`

External callers don't send a Supabase JWT. Each function authenticates
via a different signal (HMAC signature, internal secret, cron header).

- `stripe-webhook` — Stripe sends `Stripe-Signature`; verified via HMAC-SHA256
- `auto-validate-bookings` — cron, gated by `INTERNAL_EDGE_SECRET`
- `expire-stale-pending-payments` — cron, gated by `INTERNAL_EDGE_SECRET`
- `hold-deposit` — cron, gated by `INTERNAL_EDGE_SECRET`
- `admin-sync-stripe-accounts` — one-shot, gated by `INTERNAL_EDGE_SECRET`
  (safe to delete from the dashboard once confirmed unused)
- `send-email` — generic email dispatch. Has its own auth (`getAuthorized()`
  requires the service-role key in `Authorization: Bearer …` OR an
  `x-internal-secret` header matching `INTERNAL_EDGE_SECRET`). Kept off
  `verify_jwt` because the supabase-js Deno SDK's `.functions.invoke()`
  doesn't reliably attach `Authorization: Bearer <service_role_key>`,
  which made every internal email dispatch (chat-notify, stripe-webhook,
  manage-deposit, hold-deposit, send-admin-email, finalize-booking-
  payment …) 401 at the runtime layer before the function code ran.
