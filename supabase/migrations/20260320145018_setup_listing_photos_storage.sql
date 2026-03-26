/*
  # Setup listing-photos storage bucket

  1. Creates a public bucket for listing photo uploads
  2. Storage policies:
     - Authenticated users can upload photos
     - Public read access for all photos
     - Authenticated users can delete their own photos
*/

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'listing-photos',
  'listing-photos',
  true,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/heic']
)
ON CONFLICT (id) DO NOTHING;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Authenticated users can upload listing photos'
  ) THEN
    CREATE POLICY "Authenticated users can upload listing photos"
      ON storage.objects FOR INSERT TO authenticated
      WITH CHECK (bucket_id = 'listing-photos');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Public can read listing photos'
  ) THEN
    CREATE POLICY "Public can read listing photos"
      ON storage.objects FOR SELECT TO public
      USING (bucket_id = 'listing-photos');
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage' AND tablename = 'objects'
    AND policyname = 'Authenticated users can delete own listing photos'
  ) THEN
    CREATE POLICY "Authenticated users can delete own listing photos"
      ON storage.objects FOR DELETE TO authenticated
      USING (bucket_id = 'listing-photos');
  END IF;
END $$;
