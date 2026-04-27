/*
  # Generic per-key rate-limit table for edge functions

  Used by maps-proxy (and future quota-aware functions) to throttle
  callers without depending on Redis. The check_rate_limit RPC does an
  atomic upsert so concurrent calls cannot race past the cap.

  Window is wallclock-aligned per key: the first call starts the window,
  subsequent calls within p_window_seconds increment count, and the
  next call after the window resets count to 1.
*/

CREATE TABLE IF NOT EXISTS public.edge_rate_limit (
  key          text        PRIMARY KEY,
  count        int         NOT NULL DEFAULT 1,
  window_start timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS edge_rate_limit_window_start_idx
  ON public.edge_rate_limit (window_start);

ALTER TABLE public.edge_rate_limit ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.edge_rate_limit FROM authenticated, anon;

CREATE OR REPLACE FUNCTION public.check_rate_limit(
  p_key text,
  p_max_per_window int,
  p_window_seconds int
) RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count int;
BEGIN
  INSERT INTO public.edge_rate_limit(key, count, window_start)
  VALUES (p_key, 1, now())
  ON CONFLICT (key) DO UPDATE
    SET
      count = CASE
        WHEN edge_rate_limit.window_start < now() - make_interval(secs => p_window_seconds)
          THEN 1
        ELSE edge_rate_limit.count + 1
      END,
      window_start = CASE
        WHEN edge_rate_limit.window_start < now() - make_interval(secs => p_window_seconds)
          THEN now()
        ELSE edge_rate_limit.window_start
      END
  RETURNING count INTO v_count;

  RETURN v_count <= p_max_per_window;
END;
$$;

REVOKE ALL ON FUNCTION public.check_rate_limit(text, int, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, int, int) TO service_role;
