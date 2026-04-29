/*
  # Lock down listings.renter_fee_percent / owner_commission_percent
  (audit P1 — commission bypass)

  Background
  ----------
  The "Loueur modifie ses listings" RLS policy on public.listings grants
  UPDATE on the whole row, with no column-level restriction. Combined
  with create-payment-intent reading those columns at PI-creation time,
  the owner can:

      await supabase.from('listings').update({
        renter_fee_percent: 0,
        owner_commission_percent: 0,
      }).eq('id', myListingId);

  …right before the renter pays, and pocket 100 % of the rental amount
  while the platform sees application_fee_amount = 0. Tested locally:
  the update returns success and create-payment-intent reflects the new
  zero fees.

  Fix
  ---
  - Reset any tampered or NULL values back to the canonical defaults
    (7 % renter fee, 8 % owner commission) for existing rows.
  - Add a BEFORE UPDATE trigger that rejects any change to the two fee
    columns unless the caller is service_role (edge functions) or an
    admin (settled via the existing is_current_user_admin() helper).

  Why a trigger and not column-level grants
  -----------------------------------------
  Column-level GRANT/REVOKE is fragile: every new column added to
  listings would silently inherit the table-level UPDATE grant, and
  removing the table-level grant breaks legitimate UPDATEs (name,
  price, photos…). A trigger is column-scoped, survives schema growth,
  and produces a clear error on attempted bypass.

  No client follow-up needed: a grep across app/, lib/, components/
  shows zero call sites updating these two columns from the client.
*/

-- 1. Reset tampered or never-initialised rows. Use the canonical defaults
--    (7 % / 8 %). Anyone with a non-default value at this point either
--    set it before the trigger landed or had a NULL — neither is a
--    legitimate state since the platform has never let owners pick a
--    custom rate.
UPDATE public.listings
   SET renter_fee_percent = 7
 WHERE renter_fee_percent IS DISTINCT FROM 7;

UPDATE public.listings
   SET owner_commission_percent = 8
 WHERE owner_commission_percent IS DISTINCT FROM 8;

-- 2. Trigger guard. Fires on every UPDATE, but is a cheap no-op when the
--    fee columns are unchanged (the IS DISTINCT FROM short-circuits).
CREATE OR REPLACE FUNCTION public.guard_listings_fee_columns()
RETURNS trigger
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- Fast path: caller did not touch the fee columns.
  IF NEW.renter_fee_percent IS NOT DISTINCT FROM OLD.renter_fee_percent
     AND NEW.owner_commission_percent IS NOT DISTINCT FROM OLD.owner_commission_percent THEN
    RETURN NEW;
  END IF;

  -- service_role (edge functions running with the service-role key)
  -- bypasses the guard. auth.role() reads the JWT role claim that
  -- PostgREST stores in request.jwt.claims; for service-role keys this
  -- returns 'service_role'.
  IF auth.role() = 'service_role' THEN
    RETURN NEW;
  END IF;

  -- Admins (profiles.role = 'admin') may also adjust fees through the
  -- dashboard if we ever expose such a tool. Helper already exists.
  IF public.is_current_user_admin() THEN
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'renter_fee_percent / owner_commission_percent are platform-managed and cannot be modified by listing owners'
    USING ERRCODE = '42501';
END;
$$;

REVOKE ALL ON FUNCTION public.guard_listings_fee_columns() FROM PUBLIC;

DROP TRIGGER IF EXISTS listings_fee_columns_guard ON public.listings;
CREATE TRIGGER listings_fee_columns_guard
  BEFORE UPDATE ON public.listings
  FOR EACH ROW
  EXECUTE FUNCTION public.guard_listings_fee_columns();
