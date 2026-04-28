/*
  # Harden update_booking_status RPC

  Background
  ----------
  The previous RPC (migration 20260426140404) accepted these keys in
  p_extra without role-aware checks:
    handover_confirmed_owner, handover_confirmed_renter,
    return_confirmed_owner,   return_confirmed_renter,
    return_confirmed_at,      owner_validated

  Two real exploit chains:

  1. Cross-role tampering — a renter could pass
     `{return_confirmed_owner: true}` and forge the owner's confirmation.

  2. Client-supplied timestamp — `return_confirmed_at` was taken verbatim
     from the client. Combined with (1), a renter could call:
       update_booking_status(b, 'in_progress',
         '{"return_confirmed_owner": true,
           "return_confirmed_at": "2020-01-01T00:00:00Z"}')
     setting an arbitrary past date. The auto-validate-bookings cron
     would then complete the booking 24h after that fake date and
     release the deposit, with no real "both parties confirmed" gate.

  3. owner_validated could be flipped by anyone listed on the booking,
     not just the owner.

  Fix
  ---
  - Caller's role determines which extra keys are accepted:
      owner   -> handover_confirmed_owner, return_confirmed_owner
      renter  -> handover_confirmed_renter, return_confirmed_renter
    Anything else (including return_confirmed_at, owner_validated, or
    the *other* party's flag) is rejected with an explicit error.
  - return_confirmed_at is set server-side to now() exactly when we
    transition in_progress -> pending_owner_validation, and only when
    both return_confirmed_owner AND return_confirmed_renter end up true
    after applying p_extra.
  - owner_validated is set server-side to true exactly when the owner
    triggers pending_owner_validation -> completed.
  - active -> in_progress requires both handover confirmations after
    applying p_extra (mirrors the both-must-confirm rule).
  - The status transition matrix and field-only update path are
    preserved, so existing UI flows still work.

  Client follow-up
  ----------------
  app/chat/[id].tsx must stop sending return_confirmed_at and
  owner_validated. The chat screen UI countdown can use the local clock
  as an estimate; the cron uses the server-stamped timestamp.
*/

CREATE OR REPLACE FUNCTION public.update_booking_status(
  p_booking_id uuid,
  p_new_status text,
  p_extra      jsonb DEFAULT '{}'::jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_booking bookings%ROWTYPE;
  v_caller uuid;
  v_is_owner boolean;
  v_is_renter boolean;
  v_allowed_statuses text[];
  v_caller_allowed_keys text[];
  v_key text;
  v_handover_owner boolean;
  v_handover_renter boolean;
  v_return_owner boolean;
  v_return_renter boolean;
  v_set_return_at boolean := false;
  v_set_owner_validated boolean := false;
  v_now timestamptz := now();
BEGIN
  v_caller := auth.uid();

  IF v_caller IS NULL THEN
    RETURN jsonb_build_object('error', 'Not authenticated');
  END IF;

  SELECT * INTO v_booking FROM public.bookings WHERE id = p_booking_id;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'Booking not found');
  END IF;

  v_is_owner  := (v_booking.owner_id  = v_caller);
  v_is_renter := (v_booking.renter_id = v_caller);

  IF NOT (v_is_owner OR v_is_renter) THEN
    RETURN jsonb_build_object('error', 'Access denied');
  END IF;

  -- Role-aware allowed extra keys. Owner sets only the owner-side flag;
  -- renter sets only the renter-side flag. return_confirmed_at and
  -- owner_validated are NEVER accepted from the client (server derives).
  IF v_is_owner THEN
    v_caller_allowed_keys := ARRAY['handover_confirmed_owner', 'return_confirmed_owner'];
  ELSE
    v_caller_allowed_keys := ARRAY['handover_confirmed_renter', 'return_confirmed_renter'];
  END IF;

  FOR v_key IN SELECT k FROM jsonb_object_keys(p_extra) AS k LOOP
    IF NOT (v_key = ANY(v_caller_allowed_keys)) THEN
      RETURN jsonb_build_object('error', 'Field not allowed for caller role: ' || v_key);
    END IF;
    IF (p_extra->>v_key) NOT IN ('true', 'false') THEN
      RETURN jsonb_build_object('error', 'Field must be boolean: ' || v_key);
    END IF;
  END LOOP;

  -- Compute the post-update confirmation state. Each side's flag can
  -- only be flipped by that side, so we pull the caller's incoming
  -- value when allowed and fall back to the stored value otherwise.
  v_handover_owner := COALESCE(
    CASE WHEN v_is_owner THEN (p_extra->>'handover_confirmed_owner')::boolean END,
    v_booking.handover_confirmed_owner,
    false
  );
  v_handover_renter := COALESCE(
    CASE WHEN v_is_renter THEN (p_extra->>'handover_confirmed_renter')::boolean END,
    v_booking.handover_confirmed_renter,
    false
  );
  v_return_owner := COALESCE(
    CASE WHEN v_is_owner THEN (p_extra->>'return_confirmed_owner')::boolean END,
    v_booking.return_confirmed_owner,
    false
  );
  v_return_renter := COALESCE(
    CASE WHEN v_is_renter THEN (p_extra->>'return_confirmed_renter')::boolean END,
    v_booking.return_confirmed_renter,
    false
  );

  -- Field-only update path (no status change). Only the caller's own
  -- confirmation gets persisted; the other party's stored value is
  -- untouched (the COALESCE chain above used the stored value for the
  -- non-caller side).
  IF p_new_status = v_booking.status AND p_extra != '{}'::jsonb THEN
    UPDATE public.bookings
    SET handover_confirmed_owner  = v_handover_owner,
        handover_confirmed_renter = v_handover_renter,
        return_confirmed_owner    = v_return_owner,
        return_confirmed_renter   = v_return_renter
    WHERE id = p_booking_id;

    RETURN jsonb_build_object('success', true);
  END IF;

  -- Status transition matrix
  IF v_is_owner THEN
    CASE v_booking.status
      WHEN 'pending'                  THEN v_allowed_statuses := ARRAY['accepted', 'refused'];
      WHEN 'pending_payment'          THEN v_allowed_statuses := ARRAY['accepted', 'refused'];
      WHEN 'active'                   THEN v_allowed_statuses := ARRAY['in_progress'];
      WHEN 'in_progress'              THEN v_allowed_statuses := ARRAY['pending_owner_validation', 'disputed'];
      WHEN 'pending_owner_validation' THEN v_allowed_statuses := ARRAY['completed', 'disputed'];
      ELSE                                 v_allowed_statuses := ARRAY[]::text[];
    END CASE;
  END IF;

  IF v_is_renter AND NOT v_is_owner THEN
    CASE v_booking.status
      WHEN 'accepted'                 THEN v_allowed_statuses := ARRAY['pending_payment'];
      WHEN 'active'                   THEN v_allowed_statuses := ARRAY['in_progress'];
      WHEN 'in_progress'              THEN v_allowed_statuses := ARRAY['pending_owner_validation'];
      WHEN 'pending_owner_validation' THEN v_allowed_statuses := ARRAY['disputed'];
      ELSE                                 v_allowed_statuses := ARRAY[]::text[];
    END CASE;
  END IF;

  IF NOT (p_new_status = ANY(v_allowed_statuses)) THEN
    RETURN jsonb_build_object(
      'error', 'Transition not allowed: ' || v_booking.status || ' -> ' || p_new_status
    );
  END IF;

  -- Both-parties gates for transitions that imply mutual confirmation
  IF v_booking.status = 'active' AND p_new_status = 'in_progress' THEN
    IF NOT (v_handover_owner AND v_handover_renter) THEN
      RETURN jsonb_build_object('error', 'Both parties must confirm handover before starting the rental');
    END IF;
  END IF;

  IF v_booking.status = 'in_progress' AND p_new_status = 'pending_owner_validation' THEN
    IF NOT (v_return_owner AND v_return_renter) THEN
      RETURN jsonb_build_object('error', 'Both parties must confirm return before validation');
    END IF;
    v_set_return_at := true;
  END IF;

  -- Owner-only auto-stamp on the final approval
  IF v_booking.status = 'pending_owner_validation' AND p_new_status = 'completed' AND v_is_owner THEN
    v_set_owner_validated := true;
  END IF;

  UPDATE public.bookings
  SET
    status                    = p_new_status,
    handover_confirmed_owner  = v_handover_owner,
    handover_confirmed_renter = v_handover_renter,
    return_confirmed_owner    = v_return_owner,
    return_confirmed_renter   = v_return_renter,
    return_confirmed_at       = CASE WHEN v_set_return_at THEN v_now ELSE return_confirmed_at END,
    owner_validated           = CASE WHEN v_set_owner_validated THEN true ELSE owner_validated END
  WHERE id = p_booking_id;

  RETURN jsonb_build_object(
    'success', true,
    'new_status', p_new_status,
    'return_confirmed_at', CASE WHEN v_set_return_at THEN v_now END
  );
END;
$$;
