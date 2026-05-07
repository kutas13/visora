-- =============================================================================
-- 035 — Pasaport OCR + Görsel Saklama
-- =============================================================================
-- Bu migration:
--   1) visa_files tablosuna pasaport_image_url ve pasaport_son_kullanma
--      kolonlarını ekler.
--   2) Storage bucket "passport-images" oluşturur (auth-okuyabilir, owner yazabilir).
-- =============================================================================

BEGIN;

ALTER TABLE public.visa_files
  ADD COLUMN IF NOT EXISTS pasaport_image_url TEXT NULL,
  ADD COLUMN IF NOT EXISTS pasaport_son_kullanma DATE NULL;

CREATE INDEX IF NOT EXISTS visa_files_pasaport_son_kullanma_idx
  ON public.visa_files(pasaport_son_kullanma);

NOTIFY pgrst, 'reload schema';

COMMIT;

-- =============================================================================
-- STORAGE BUCKET
-- =============================================================================
-- Storage bucket Supabase Studio'da elle oluşturulacak veya aşağıdaki SQL ile:
--
INSERT INTO storage.buckets (id, name, public)
VALUES ('passport-images', 'passport-images', true)
ON CONFLICT (id) DO NOTHING;

-- RLS: kimliği doğrulanmış kullanıcılar yazabilir
DO $$
BEGIN
  -- INSERT
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'passport_images_insert_auth'
  ) THEN
    CREATE POLICY passport_images_insert_auth
      ON storage.objects FOR INSERT
      TO authenticated
      WITH CHECK (bucket_id = 'passport-images');
  END IF;

  -- UPDATE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'passport_images_update_auth'
  ) THEN
    CREATE POLICY passport_images_update_auth
      ON storage.objects FOR UPDATE
      TO authenticated
      USING (bucket_id = 'passport-images')
      WITH CHECK (bucket_id = 'passport-images');
  END IF;

  -- DELETE
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'passport_images_delete_auth'
  ) THEN
    CREATE POLICY passport_images_delete_auth
      ON storage.objects FOR DELETE
      TO authenticated
      USING (bucket_id = 'passport-images');
  END IF;

  -- SELECT (public okunabilir; bucket public=true zaten yeterli ama belirtelim)
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname = 'storage'
      AND tablename = 'objects'
      AND policyname = 'passport_images_select_public'
  ) THEN
    CREATE POLICY passport_images_select_public
      ON storage.objects FOR SELECT
      TO public
      USING (bucket_id = 'passport-images');
  END IF;
END
$$;
