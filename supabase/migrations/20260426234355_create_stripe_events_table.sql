/*
  # P1-5 — stripe_events idempotency table

  Stripe retries webhooks aggressively when the endpoint replies with a
  non-2xx, and at-least-once delivery means the same event_id can land
  twice within minutes. Without a deduplication anchor the webhook
  re-runs the entire side-effect path (booking activation + emails).

  This table is a PRIMARY KEY (event_id) idempotency log:
  - INSERT ... ON CONFLICT DO NOTHING at the very top of the handler
    aborts duplicate processing.
  - On success the row flips to status='processed'.
  - On a transient failure the row flips to status='failed' and the
    handler returns 5xx so Stripe will retry, which then collides on
    the unique key and short-circuits to a 200.

  Service-role only — clients have no business reading webhook history.
*/

CREATE TABLE IF NOT EXISTS public.stripe_events (
  event_id     text        PRIMARY KEY,
  type         text        NOT NULL,
  status       text        NOT NULL DEFAULT 'received'
    CHECK (status IN ('received','processed','failed')),
  booking_id   uuid,
  error        text,
  created_at   timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX IF NOT EXISTS stripe_events_status_created_at_idx
  ON public.stripe_events (status, created_at DESC);

ALTER TABLE public.stripe_events ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.stripe_events FROM authenticated, anon;

DROP POLICY IF EXISTS "stripe_events no client access" ON public.stripe_events;
CREATE POLICY "stripe_events no client access"
  ON public.stripe_events
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);
