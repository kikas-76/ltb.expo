/*
  # Fix race condition in handover/return confirmation transitions

  Problem
  -------
  When the second participant confirms within seconds of the first,
  the client's `setReturnConfirmed{Owner,Renter}` local state for
  the OPPOSITE party is still stale (realtime subscription hasn't
  caught up). The client therefore decides "only one flag set, go
  to the same-status branch" and never asks for the transition.
  Both flags end up true server-side but the booking stays in
  `in_progress` (or `active` for handover), forever stuck.

  Reproduced live on booking df583d03 on 2026-05-06: owner confirmed
  return at 16:48:16, renter at 16:48:25 — both flags became true,
  status stayed in_progress, return_confirmed_at remained null.

  Fix
  ---
  Move the transition logic server-side. When the caller passes a
  flag update (same-status branch), compute the post-update flag
  state and auto-transition if both flags are true:
    - status='active'      + both handover flags → 'in_progress'
    - status='in_progress' + both return flags   → 'pending_owner_validation'
                                                   (stamps return_confirmed_at)

  This eliminates the race regardless of subscription latency. The
  existing explicit transition path (caller passes p_new_status !=
  v_booking.status) is preserved unchanged for compatibility.
*/

CREATE OR REPLACE FUNCTION public.update_booking_status(p_booking_id uuid, p_new_status text, p_extra jsonb DEFAULT '{}'::jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'pg_temp'
AS $function$
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
  v_auto_status text := NULL;
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

  -- Same-status branch: caller is just updating their flag. Auto-transition
  -- if the post-update state means both flags are now true. Eliminates the
  -- client-side race when the second party clicks before realtime catches up.
  IF p_new_status = v_booking.status AND p_extra != '{}'::jsonb THEN
    IF v_booking.status = 'active' AND v_handover_owner AND v_handover_renter THEN
      v_auto_status := 'in_progress';
    ELSIF v_booking.status = 'in_progress' AND v_return_owner AND v_return_renter THEN
      v_auto_status := 'pending_owner_validation';
      v_set_return_at := true;
    END IF;

    UPDATE public.bookings
    SET status                    = COALESCE(v_auto_status, status),
        handover_confirmed_owner  = v_handover_owner,
        handover_confirmed_renter = v_handover_renter,
        return_confirmed_owner    = v_return_owner,
        return_confirmed_renter   = v_return_renter,
        return_confirmed_at       = CASE WHEN v_set_return_at THEN v_now ELSE return_confirmed_at END
    WHERE id = p_booking_id;

    RETURN jsonb_build_object(
      'success', true,
      'auto_transitioned_to', v_auto_status,
      'return_confirmed_at', CASE WHEN v_set_return_at THEN v_now END
    );
  END IF;

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
$function$;
