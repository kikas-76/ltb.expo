/*
  # RLS : le requester peut annuler sa propre demande pending

  Avant ce changement, seul l'owner pouvait UPDATE conversations.status
  (policy "Owner can update conversation status"). Le requester n'avait
  donc aucun moyen de retirer une demande qu'il avait postée — il devait
  attendre que l'owner refuse.

  Nouvelle policy permissive très étroite :
  - USING : la ligne doit appartenir au caller en tant que requester
    ET être encore en status 'pending'.
  - WITH CHECK : la transition doit aller vers 'cancelled' uniquement.
    Empêche d'utiliser cette policy pour passer en 'accepted' ou
    'refused' (qui restent owner-only via l'autre policy).

  Le client appelle ensuite DELETE sur la même conversation. Le trigger
  guard_conversation_delete laisse passer parce que le status est devenu
  'cancelled' (terminal). Aucune ligne bookings n'existe encore à ce
  moment du flow (les bookings sont créés à l'acceptation).
*/

CREATE POLICY "Requester can cancel pending conversation"
ON public.conversations
FOR UPDATE
USING  (auth.uid() = requester_id AND status = 'pending')
WITH CHECK (auth.uid() = requester_id AND status = 'cancelled');
