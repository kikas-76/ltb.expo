/*
  # Lock down function search_path + clarify edge_rate_limit RLS (P2-1)

  Two batches of advisor warnings:

  1. function_search_path_mutable on six functions. Setting an explicit
     search_path closes the well-known privilege-escalation vector where
     an attacker creates a same-named object in a schema earlier in the
     resolution order. We pick `public, pg_temp` to keep the existing
     unqualified table refs working while still nailing down the order.

  2. rls_enabled_no_policy on public.edge_rate_limit (INFO). The table
     is intentionally service_role-only (already enforced by the REVOKE
     in 20260426150000), but the linter cannot tell intent from accident.
     Add an explicit deny-all policy for authenticated/anon so the
     contract is documented in the policy table itself.

  Remaining advisors not addressed in this migration:
  - extension_in_public on pg_trgm / unaccent / pg_net.
    Moving them to a dedicated `extensions` schema is a separate change
    because public.immutable_unaccent → unaccent() is referenced by an
    index on public.listings (search_vector). A schema move requires
    qualifying every call site or extending the function's search_path,
    and rebuilding the dependent index. Tracked for a later migration.
  - auth_leaked_password_protection. Toggle in the Supabase Dashboard
    under Authentication > Settings > Password protection.
*/

ALTER FUNCTION public.fn_decrement_saves_count()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.fn_increment_saves_count()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.fn_increment_views_count()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.fn_decrement_views_count()
  SET search_path = public, pg_temp;

ALTER FUNCTION public.get_nearby_listings(
  double precision, double precision, double precision, integer, integer
) SET search_path = public, pg_temp;

ALTER FUNCTION public.update_booking_status(uuid, text, jsonb)
  SET search_path = public, pg_temp;

DROP POLICY IF EXISTS "edge_rate_limit no client access" ON public.edge_rate_limit;
CREATE POLICY "edge_rate_limit no client access"
  ON public.edge_rate_limit
  FOR ALL
  TO authenticated, anon
  USING (false)
  WITH CHECK (false);
