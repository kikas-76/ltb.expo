-- Demandes acceptées jamais payées dont la date de début est passée.
--
-- Avant : elles gardaient « Payer maintenant » indéfiniment dans Messages et le
-- paiement échouait (« dates déjà passées »). Elles passent désormais en
-- « cancelled », comme après l'expiration d'un paiement non fait
-- (expire-stale-pending-payments), statut que l'app affiche déjà (« Annulée »).
--
-- Une conversation qui a une réservation en cours, payée, terminée ou en
-- litige n'est jamais touchée (une location terminée garde sa conversation en
-- « accepted »). Le compte démo App Review n'est pas concerné tant que sa
-- réservation pending_payment existe (exemptée d'expiration).
--
-- Fonction appelée uniquement par la tâche cron « expire-stale-conversations »
-- (compte postgres, propriétaire) : plus d'exécution possible depuis l'API.

CREATE OR REPLACE FUNCTION public.expire_stale_conversations()
 RETURNS integer
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
DECLARE
  expired_count integer;
  cancelled_count integer;
BEGIN
  -- Demandes restées sans réponse du propriétaire pendant 48 h.
  WITH expired AS (
    UPDATE conversations
    SET status = 'refused'
    WHERE status = 'pending'
    AND created_at < now() - interval '48 hours'
    RETURNING id
  )
  SELECT count(*) INTO expired_count FROM expired;

  -- Demandes acceptées jamais payées dont la date de début est passée.
  WITH stale_accepted AS (
    UPDATE conversations c
    SET status = 'cancelled'
    WHERE c.status = 'accepted'
      AND c.start_date < (now() AT TIME ZONE 'Europe/Paris')::date
      AND NOT EXISTS (
        SELECT 1 FROM bookings b
        WHERE b.conversation_id = c.id
          AND b.status IN ('pending_payment', 'active', 'in_progress', 'pending_return',
                           'pending_owner_validation', 'completed', 'disputed')
      )
    RETURNING c.id
  )
  SELECT count(*) INTO cancelled_count FROM stale_accepted;

  RETURN expired_count + cancelled_count;
END;
$function$;

REVOKE EXECUTE ON FUNCTION public.expire_stale_conversations() FROM PUBLIC, anon, authenticated;
