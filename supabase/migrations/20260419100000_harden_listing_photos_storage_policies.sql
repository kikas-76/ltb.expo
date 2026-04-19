/*
  # Harden listing-photos storage policies

  The original policies (migration 20260320145018) allowed any authenticated
  user to insert OR delete ANY object in the listing-photos bucket because
  neither the INSERT WITH CHECK nor the DELETE USING clause restricted the
  object path to the caller's own folder.

  Concretely, the upload path is `{user.id}/{timestamp}-{rand}.{ext}` (see
  app/create-listing.tsx). We enforce that the first folder segment of the
  object name matches auth.uid() for INSERT, UPDATE and DELETE — same pattern
  the avatars bucket already uses (migration 20260320170018).

  Public SELECT stays unchanged: listing photos must remain readable by
  anyone since the marketplace renders them on public pages.
*/

DROP POLICY IF EXISTS "Authenticated users can upload listing photos" ON storage.objects;
DROP POLICY IF EXISTS "Authenticated users can delete own listing photos" ON storage.objects;

CREATE POLICY "Users can upload to their own listing-photos folder"
  ON storage.objects FOR INSERT
  TO authenticated
  WITH CHECK (
    bucket_id = 'listing-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can update their own listing-photos"
  ON storage.objects FOR UPDATE
  TO authenticated
  USING (
    bucket_id = 'listing-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  )
  WITH CHECK (
    bucket_id = 'listing-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );

CREATE POLICY "Users can delete their own listing-photos"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (
    bucket_id = 'listing-photos'
    AND (storage.foldername(name))[1] = auth.uid()::text
  );
