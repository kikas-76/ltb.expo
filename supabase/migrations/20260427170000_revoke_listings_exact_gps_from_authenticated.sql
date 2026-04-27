/*
  # Phase 2: revoke exact GPS / location_data from authenticated callers

  Why REVOKE ALL + targeted GRANT (not column-level REVOKE)
  --------------------------------------------------------
  The natural-looking `REVOKE SELECT (latitude, longitude, location_data)
  FROM authenticated` is a NO-OP when the role already has a table-wide
  `GRANT SELECT ON public.listings`. Postgres treats column-level revokes
  as removing column-level grants only; the table-wide grant continues to
  cover every column, including future ones.

  The fix is the same shape as 20260427150000 used for anon: revoke all,
  then re-grant only the safe column subset. Write privileges (INSERT /
  UPDATE / DELETE) are re-granted at the table level — RLS handles the
  per-row check via the existing "Loueur crée/modifie/supprime ses
  listings" policies.

  Pre-flight checklist
  --------------------
  Apply this AFTER the web/native app is shipped with the column rename
  (latitude → approx_latitude, longitude → approx_longitude) and the
  get_listing_exact_location RPC. Running it earlier breaks every
  authenticated select on listings that still references the old columns.

  After this migration:
  - Anon: same 18-column safe subset (set up in 20260427150000)
  - Authenticated: same 20-column safe subset (anon set + approx_*)
  - Owners / admins / renters with a booking >= accepted fetch the exact
    GPS / address through the SECURITY DEFINER RPC
    `public.get_listing_exact_location(uuid)`.
*/

REVOKE ALL ON public.listings FROM authenticated;

GRANT SELECT (
  id,
  owner_id,
  name,
  description,
  price,
  deposit_amount,
  renter_fee_percent,
  owner_commission_percent,
  photos_url,
  category_id,
  category_name,
  subcategory_id,
  subcategory_name,
  owner_type,
  is_active,
  approx_latitude,
  approx_longitude,
  views_count,
  saves_count,
  created_at
) ON public.listings TO authenticated;

-- Write privileges re-established. The RLS policies introduced in
-- 20260411214148_fix_security_indexes_rls_policies.sql ("Loueur crée /
-- modifie / supprime ses listings") still gate per-row access.
GRANT INSERT, UPDATE, DELETE ON public.listings TO authenticated;

-- Defense in depth on anon (was already revoked in 20260427150000;
-- assert again for explicitness).
REVOKE SELECT (latitude, longitude, location_data)
  ON public.listings
  FROM anon;
