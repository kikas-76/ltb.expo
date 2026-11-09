-- Masquage d'une conversation pour un seul participant. Une conversation liée à
-- une réservation ne peut pas être supprimée (guard_conversation_delete) : elle
-- sert de preuve en cas de litige et reste visible pour l'autre personne.
CREATE TABLE public.conversation_hides (
  conversation_id uuid NOT NULL REFERENCES public.conversations(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hidden_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (conversation_id, user_id)
);

CREATE INDEX conversation_hides_user_id_idx ON public.conversation_hides (user_id);

ALTER TABLE public.conversation_hides ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read their hidden conversations"
  ON public.conversation_hides FOR SELECT TO authenticated
  USING (user_id = (SELECT auth.uid()));

CREATE POLICY "Participants hide their conversations"
  ON public.conversation_hides FOR INSERT TO authenticated
  WITH CHECK (
    user_id = (SELECT auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id = conversation_id
        AND (SELECT auth.uid()) IN (c.requester_id, c.owner_id)
    )
  );

CREATE POLICY "Users update their hidden conversations"
  ON public.conversation_hides FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid()))
  WITH CHECK (user_id = (SELECT auth.uid()));

GRANT SELECT, INSERT, UPDATE ON public.conversation_hides TO authenticated;
