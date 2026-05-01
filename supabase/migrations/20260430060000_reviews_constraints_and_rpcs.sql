/*
  # Reviews — bidirectional rating system

  The `public.reviews` table existed but was unused: no constraints
  beyond the FK pair, no submission RPC, no aggregation, no UI. Wire
  the whole thing now.

  Design (validated with the user):
   - Bidirectional: renter ↔ owner after a booking reaches `completed`.
   - 1–5 stars + optional free comment (≤ 1000 chars).
   - Publication is immediate (no Airbnb-style hold-and-reveal). The
     reviewer can edit during a 7-day window from creation; afterwards
     locked.
   - Cached aggregates (`rating_avg`, `rating_count`) on profiles + listings
     so feed cards / detail pages don't fan out an RPC per row.

  All triggers are SECURITY INVOKER except the aggregate refresh
  (which has to UPDATE rows the caller may not own); service_role
  bypasses both validation triggers (admin tooling, future cleanups).
*/

-- 1. Row-level constraints
ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_rating_range
  CHECK (rating BETWEEN 1 AND 5);

ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_comment_length
  CHECK (comment IS NULL OR length(comment) <= 1000);

ALTER TABLE public.reviews
  ADD CONSTRAINT reviews_no_self_review
  CHECK (reviewer_id <> reviewed_id);

CREATE UNIQUE INDEX IF NOT EXISTS reviews_one_per_booking_per_reviewer
  ON public.reviews (booking_id, reviewer_id);

CREATE INDEX IF NOT EXISTS reviews_reviewed_id_idx
  ON public.reviews (reviewed_id);
CREATE INDEX IF NOT EXISTS reviews_listing_id_idx
  ON public.reviews (listing_id);

-- 2. updated_at + auto-touch trigger
ALTER TABLE public.reviews
  ADD COLUMN IF NOT EXISTS updated_at timestamptz DEFAULT now();

CREATE OR REPLACE FUNCTION public.reviews_set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reviews_set_updated_at_trg ON public.reviews;
CREATE TRIGGER reviews_set_updated_at_trg
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.reviews_set_updated_at();

-- 3. INSERT validation: reviewer + reviewed_id consistency, booking state
CREATE OR REPLACE FUNCTION public.reviews_validate_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_booking record;
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  SELECT renter_id, owner_id, listing_id, status
    INTO v_booking
    FROM public.bookings
   WHERE id = NEW.booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Réservation introuvable.' USING ERRCODE = '23503';
  END IF;

  IF v_booking.status <> 'completed' THEN
    RAISE EXCEPTION 'Tu ne peux noter qu''une location terminée (statut %).', v_booking.status
      USING ERRCODE = '42501';
  END IF;

  IF NEW.reviewer_id NOT IN (v_booking.renter_id, v_booking.owner_id) THEN
    RAISE EXCEPTION 'Tu n''es pas participant de cette location.' USING ERRCODE = '42501';
  END IF;

  -- The reviewed_id must be the *other* participant.
  IF NEW.reviewer_id = v_booking.renter_id AND NEW.reviewed_id <> v_booking.owner_id THEN
    RAISE EXCEPTION 'L''utilisateur évalué doit être le propriétaire de la location.' USING ERRCODE = '42501';
  END IF;
  IF NEW.reviewer_id = v_booking.owner_id AND NEW.reviewed_id <> v_booking.renter_id THEN
    RAISE EXCEPTION 'L''utilisateur évalué doit être le locataire.' USING ERRCODE = '42501';
  END IF;

  IF NEW.listing_id <> v_booking.listing_id THEN
    RAISE EXCEPTION 'L''annonce ne correspond pas à cette location.' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reviews_validate_insert_trg ON public.reviews;
CREATE TRIGGER reviews_validate_insert_trg
  BEFORE INSERT ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.reviews_validate_insert();

-- 4. UPDATE: 7-day edit window + immutable fields
CREATE OR REPLACE FUNCTION public.reviews_lock_after_window()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF OLD.booking_id IS DISTINCT FROM NEW.booking_id
     OR OLD.reviewer_id IS DISTINCT FROM NEW.reviewer_id
     OR OLD.reviewed_id IS DISTINCT FROM NEW.reviewed_id
     OR OLD.listing_id IS DISTINCT FROM NEW.listing_id THEN
    RAISE EXCEPTION 'Ces champs ne sont pas modifiables.' USING ERRCODE = '42501';
  END IF;

  IF now() - OLD.created_at > interval '7 days' THEN
    RAISE EXCEPTION 'Cette évaluation est verrouillée (au-delà de 7 jours).' USING ERRCODE = '42501';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS reviews_lock_after_window_trg ON public.reviews;
CREATE TRIGGER reviews_lock_after_window_trg
  BEFORE UPDATE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.reviews_lock_after_window();

-- 5. RLS: reviewer can update own review only inside the 7-day window
DROP POLICY IF EXISTS "Reviewer can update own review" ON public.reviews;
CREATE POLICY "Reviewer can update own review within window"
  ON public.reviews FOR UPDATE
  TO authenticated
  USING (
    (SELECT auth.uid()) = reviewer_id
    AND now() - created_at <= interval '7 days'
  )
  WITH CHECK (
    (SELECT auth.uid()) = reviewer_id
    AND now() - created_at <= interval '7 days'
  );

-- 6. Cached aggregates on profiles + listings (perf: feed cards read these directly)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rating_avg numeric(3,2) DEFAULT 0;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS rating_count integer DEFAULT 0;

ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS rating_avg numeric(3,2) DEFAULT 0;
ALTER TABLE public.listings
  ADD COLUMN IF NOT EXISTS rating_count integer DEFAULT 0;

-- New columns aren't covered by the existing column-level grants.
GRANT SELECT (rating_avg, rating_count) ON public.profiles TO authenticated, anon;
GRANT SELECT (rating_avg, rating_count) ON public.listings TO authenticated, anon;

-- 7. Aggregate refresh trigger. SECURITY DEFINER because the trigger
--    has to UPDATE the reviewed user's profile row and the listing row,
--    neither of which the reviewer owns.
CREATE OR REPLACE FUNCTION public.reviews_refresh_aggregates()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_user_id uuid;
  v_listing_id uuid;
  v_avg numeric(3,2);
  v_count int;
BEGIN
  v_user_id := COALESCE(NEW.reviewed_id, OLD.reviewed_id);
  v_listing_id := COALESCE(NEW.listing_id, OLD.listing_id);

  IF v_user_id IS NOT NULL THEN
    SELECT COALESCE(round(avg(rating)::numeric, 2), 0), count(*)
      INTO v_avg, v_count
      FROM public.reviews
     WHERE reviewed_id = v_user_id;

    UPDATE public.profiles
       SET rating_avg = v_avg, rating_count = v_count
     WHERE id = v_user_id;
  END IF;

  IF v_listing_id IS NOT NULL THEN
    SELECT COALESCE(round(avg(rating)::numeric, 2), 0), count(*)
      INTO v_avg, v_count
      FROM public.reviews
     WHERE listing_id = v_listing_id;

    UPDATE public.listings
       SET rating_avg = v_avg, rating_count = v_count
     WHERE id = v_listing_id;
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS reviews_refresh_aggregates_trg ON public.reviews;
CREATE TRIGGER reviews_refresh_aggregates_trg
  AFTER INSERT OR UPDATE OR DELETE ON public.reviews
  FOR EACH ROW
  EXECUTE FUNCTION public.reviews_refresh_aggregates();

-- 8. RPC: submit_review (UPSERT for the 7-day edit window)
CREATE OR REPLACE FUNCTION public.submit_review(
  p_booking_id uuid,
  p_rating smallint,
  p_comment text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_caller uuid := auth.uid();
  v_booking record;
  v_reviewed_id uuid;
  v_review record;
BEGIN
  IF v_caller IS NULL THEN
    RAISE EXCEPTION 'Authentification requise.' USING ERRCODE = '42501';
  END IF;

  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 THEN
    RAISE EXCEPTION 'La note doit être comprise entre 1 et 5.' USING ERRCODE = '22023';
  END IF;

  SELECT renter_id, owner_id, listing_id, status
    INTO v_booking
    FROM public.bookings
   WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'Réservation introuvable.' USING ERRCODE = '02000';
  END IF;

  IF v_booking.status <> 'completed' THEN
    RAISE EXCEPTION 'La location doit être terminée pour être notée.' USING ERRCODE = '42501';
  END IF;

  IF v_caller NOT IN (v_booking.renter_id, v_booking.owner_id) THEN
    RAISE EXCEPTION 'Tu n''es pas participant de cette location.' USING ERRCODE = '42501';
  END IF;

  v_reviewed_id := CASE
    WHEN v_caller = v_booking.renter_id THEN v_booking.owner_id
    ELSE v_booking.renter_id
  END;

  -- UPSERT — first call inserts; calls inside the 7-day window edit
  -- the rating/comment. The BEFORE UPDATE trigger gates the edit
  -- window so a stale call past day 7 raises 42501.
  INSERT INTO public.reviews (
    booking_id, reviewer_id, reviewed_id, listing_id, rating, comment
  ) VALUES (
    p_booking_id, v_caller, v_reviewed_id, v_booking.listing_id, p_rating,
    NULLIF(trim(coalesce(p_comment, '')), '')
  )
  ON CONFLICT (booking_id, reviewer_id)
    DO UPDATE SET
      rating = EXCLUDED.rating,
      comment = EXCLUDED.comment
  RETURNING * INTO v_review;

  RETURN jsonb_build_object(
    'review_id',  v_review.id,
    'rating',     v_review.rating,
    'comment',    v_review.comment,
    'created_at', v_review.created_at,
    'updated_at', v_review.updated_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.submit_review(uuid, smallint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.submit_review(uuid, smallint, text) TO authenticated;

-- 9. RPC: get_user_review_summary — avg + count + 5 last reviews
CREATE OR REPLACE FUNCTION public.get_user_review_summary(p_user_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_avg numeric(3,2);
  v_count int;
  v_recent jsonb;
BEGIN
  SELECT COALESCE(round(avg(rating)::numeric, 2), 0), count(*)
    INTO v_avg, v_count
    FROM public.reviews
   WHERE reviewed_id = p_user_id;

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb)
    INTO v_recent
    FROM (
      SELECT r.id, r.rating, r.comment, r.created_at,
             p.username    AS reviewer_username,
             p.photo_url   AS reviewer_photo_url,
             l.name        AS listing_name
        FROM public.reviews r
        LEFT JOIN public.profiles p ON p.id = r.reviewer_id
        LEFT JOIN public.listings l ON l.id = r.listing_id
       WHERE r.reviewed_id = p_user_id
       ORDER BY r.created_at DESC
       LIMIT 5
    ) t;

  RETURN jsonb_build_object(
    'average', v_avg,
    'count',   v_count,
    'recent',  v_recent
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_user_review_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_user_review_summary(uuid) TO authenticated, anon;

-- 10. RPC: get_listing_review_summary — same shape, filtered by listing
CREATE OR REPLACE FUNCTION public.get_listing_review_summary(p_listing_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_avg numeric(3,2);
  v_count int;
  v_recent jsonb;
BEGIN
  SELECT COALESCE(round(avg(rating)::numeric, 2), 0), count(*)
    INTO v_avg, v_count
    FROM public.reviews
   WHERE listing_id = p_listing_id;

  SELECT COALESCE(jsonb_agg(t), '[]'::jsonb)
    INTO v_recent
    FROM (
      SELECT r.id, r.rating, r.comment, r.created_at,
             p.username  AS reviewer_username,
             p.photo_url AS reviewer_photo_url
        FROM public.reviews r
        LEFT JOIN public.profiles p ON p.id = r.reviewer_id
       WHERE r.listing_id = p_listing_id
       ORDER BY r.created_at DESC
       LIMIT 5
    ) t;

  RETURN jsonb_build_object(
    'average', v_avg,
    'count',   v_count,
    'recent',  v_recent
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_listing_review_summary(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_listing_review_summary(uuid) TO authenticated, anon;
