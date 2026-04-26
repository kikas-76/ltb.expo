-- I9 : Policy UPDATE manquante sur chat_messages (pour is_read)
CREATE POLICY "Participants can update chat messages"
ON public.chat_messages FOR UPDATE TO authenticated
USING (
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = chat_messages.conversation_id
    AND (c.requester_id = (SELECT auth.uid()) OR c.owner_id = (SELECT auth.uid()))
  )
)
WITH CHECK (
  EXISTS (
    SELECT 1 FROM conversations c
    WHERE c.id = chat_messages.conversation_id
    AND (c.requester_id = (SELECT auth.uid()) OR c.owner_id = (SELECT auth.uid()))
  )
);

-- I1 : Recréer la vue public_profiles sans SECURITY DEFINER
DROP VIEW IF EXISTS public.public_profiles;
CREATE VIEW public.public_profiles AS
SELECT id, username, display_name, avatar_url, photo_url, bio, is_pro,
       business_name, business_address, business_type,
       business_hours, siren_number, location_data, created_at
FROM profiles;

GRANT SELECT ON public.public_profiles TO anon, authenticated;
