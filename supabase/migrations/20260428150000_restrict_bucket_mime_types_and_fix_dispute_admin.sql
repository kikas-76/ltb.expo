/*
  # Restrict allowed_mime_types on chat-attachments + dispute-evidence
  # and fix the JWT-based admin check on dispute-evidence read policy

  Background
  ----------
  Migration 20260427030000 created both private buckets with
  `allowed_mime_types = NULL`, meaning Storage accepts any MIME type at
  upload time. The client already enforces tight allowlists (see
  `CHAT_FILE_ALLOWED_MIMES` in app/chat/[id].tsx and the EXT_TO_MIME map
  in app/dispute/[booking_id].tsx) — the comments there even claim the
  bucket has matching `allowed_mime_types`. But until now there was no
  server-side gate, so anyone bypassing the UI (curl with the user's
  JWT) could upload SVG / HTML / executables to a Supabase Storage URL
  scoped to an authenticated session, opening a phishing-page risk.

  Same migration also fixes a stale JWT-app_metadata.role check on the
  dispute-evidence read policy. Project admins are flagged via
  `profiles.role = 'admin'` only (raw_app_meta_data is empty), so the
  old policy silently denied admins read access to dispute photos.
  Aligns with the helper added in 20260428100000.

  Allowlists
  ----------
  - chat-attachments: images (jpeg, png, webp, heic, heif, gif),
    PDF, MS Word, MS Excel, plain text.
  - dispute-evidence: images only (jpeg, png, webp, heic, heif, gif).
    Matches the current client picker; PDFs can be added later by
    updating both this list and the client EXT_TO_MIME map.
*/

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif',
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain'
]
WHERE id = 'chat-attachments';

UPDATE storage.buckets
SET allowed_mime_types = ARRAY[
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/heic',
  'image/heif',
  'image/gif'
]
WHERE id = 'dispute-evidence';

-- Fix the JWT-based admin check on the dispute-evidence read policy
DROP POLICY IF EXISTS "dispute-evidence participants and admin can read" ON storage.objects;
CREATE POLICY "dispute-evidence participants and admin can read"
  ON storage.objects FOR SELECT TO authenticated
  USING (
    bucket_id = 'dispute-evidence'
    AND (
      public.is_current_user_admin()
      OR EXISTS (
        SELECT 1 FROM public.bookings b
        WHERE b.id::text = (storage.foldername(name))[2]
          AND ((SELECT auth.uid()) = b.renter_id OR (SELECT auth.uid()) = b.owner_id)
      )
    )
  );
