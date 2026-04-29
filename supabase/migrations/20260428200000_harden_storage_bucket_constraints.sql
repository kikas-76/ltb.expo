/*
  # Harden storage bucket constraints (audit P2 — uploads)

  Three of our four buckets had no `file_size_limit` and/or no
  `allowed_mime_types`, which meant the app relied entirely on
  client-side checks to keep uploads sane. An attacker bypassing the
  client could:

  - upload arbitrarily large files to `avatars` (public bucket, no size
    cap → DoS storage / bill);
  - upload an `image/svg+xml` or `text/html` file to
    `chat-attachments` / `dispute-evidence` and host phishing pages
    inside our supabase.co subdomain (signed URLs, but still our
    project's reputation);
  - upload a renamed `.exe` masquerading as a chat document.

  This migration brings the three weak buckets up to the same standard
  as `listing-photos` (size cap + explicit allowlist).

  - avatars            → 5 MB, image-only.
  - chat-attachments   → 10 MB, images + PDF + common docs (the chat
                         supports document attachments via
                         DocumentPicker, so we keep the doc set but
                         exclude html/svg/exec).
  - dispute-evidence   → 10 MB, images + PDF only (evidence flows are
                         image/pdf in practice).

  No-op when the bucket doesn't exist (CONFLICT update is bucket-id
  scoped). Safe to run on a database where the buckets are already in
  the desired state.
*/

UPDATE storage.buckets
SET
  file_size_limit = 5242880,
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'image/gif'
  ]
WHERE id = 'avatars';

UPDATE storage.buckets
SET
  allowed_mime_types = ARRAY[
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
SET
  allowed_mime_types = ARRAY[
    'image/jpeg',
    'image/png',
    'image/webp',
    'image/heic',
    'image/heif',
    'image/gif',
    'application/pdf'
  ]
WHERE id = 'dispute-evidence';
