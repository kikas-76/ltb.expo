/*
  # Private buckets for chat attachments and dispute evidence (audit P1 #6)

  Background
  ----------
  Chat images, chat files and dispute evidence photos were all uploaded
  into the public `listing-photos` bucket and addressed via
  getPublicUrl. Anyone who could guess (or scrape) the URL got a
  permanent unauthenticated read of the file — a clear RGPD problem
  for ID photos / damage proof / private chat content.

  This migration creates two private buckets:
  - chat-attachments: scoped per conversation. Path convention:
      <user_id>/<conversation_id>/<timestamp>-<filename>
    The uploader must own the user_id prefix; readers must be
    participants of the conversation.
  - dispute-evidence: scoped per booking. Path convention:
      <user_id>/<booking_id>/<timestamp>.<ext>
    The uploader must own the user_id prefix; readers must be a
    booking participant (renter / owner) or an admin.

  Both buckets are private; the app fetches files via createSignedUrl()
  (1h TTL via lib/signedUrl.ts) and never exposes a permanent URL.

  Legacy chat messages stored against listing-photos public URLs keep
  rendering — the lib/signedUrl.ts resolver passes through anything
  that isn't a private:// URI unchanged.
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('chat-attachments', 'chat-attachments', false, 10485760, NULL),
  ('dispute-evidence', 'dispute-evidence', false, 10485760, NULL)
ON CONFLICT (id) DO UPDATE SET public = false;

-- ── chat-attachments ─────────────────────────────────────────
DROP POLICY IF EXISTS "chat-attachments user can upload" ON storage.objects;
CREATE POLICY "chat-attachments user can upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "chat-attachments participants can read" ON storage.objects;
CREATE POLICY "chat-attachments participants can read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND EXISTS (
      SELECT 1 FROM public.conversations c
      WHERE c.id::text = (storage.foldername(name))[2]
        AND ((SELECT auth.uid()) = c.requester_id OR (SELECT auth.uid()) = c.owner_id)
    )
  );

DROP POLICY IF EXISTS "chat-attachments uploader can delete" ON storage.objects;
CREATE POLICY "chat-attachments uploader can delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'chat-attachments'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );

-- ── dispute-evidence ─────────────────────────────────────────
DROP POLICY IF EXISTS "dispute-evidence user can upload" ON storage.objects;
CREATE POLICY "dispute-evidence user can upload"
  ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'dispute-evidence'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

DROP POLICY IF EXISTS "dispute-evidence participants and admin can read" ON storage.objects;
CREATE POLICY "dispute-evidence participants and admin can read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'dispute-evidence'
    AND (
      ((SELECT auth.jwt()) -> 'app_metadata' ->> 'role') = 'admin'
      OR EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.id::text = (storage.foldername(name))[2]
          AND ((SELECT auth.uid()) = b.renter_id OR (SELECT auth.uid()) = b.owner_id)
      )
    )
  );

DROP POLICY IF EXISTS "dispute-evidence uploader can delete" ON storage.objects;
CREATE POLICY "dispute-evidence uploader can delete"
  ON storage.objects FOR DELETE TO authenticated
  USING (
    bucket_id = 'dispute-evidence'
    AND (storage.foldername(name))[1] = (SELECT auth.uid())::text
  );
