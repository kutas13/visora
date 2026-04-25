-- =============================================================================
-- HIZLI DUZELTME — visa_files icin eksik kolonlari ekle
-- Supabase SQL Editor'da bir kez calistirin.
-- 024_visa_files_missing_columns.sql ile birebir aynidir.
-- =============================================================================

BEGIN;

ALTER TABLE public.visa_files
  ADD COLUMN IF NOT EXISTS ucret NUMERIC NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ucret_currency TEXT NULL DEFAULT 'TL',
  ADD COLUMN IF NOT EXISTS davetiye_ucreti NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS davetiye_ucreti_currency TEXT NULL,
  ADD COLUMN IF NOT EXISTS odeme_plani TEXT NULL DEFAULT 'pesin',
  ADD COLUMN IF NOT EXISTS odeme_durumu TEXT NULL DEFAULT 'odenmedi',
  ADD COLUMN IF NOT EXISTS hesap_sahibi TEXT NULL,
  ADD COLUMN IF NOT EXISTS cari_tipi TEXT NULL,
  ADD COLUMN IF NOT EXISTS cari_sahibi TEXT NULL,
  ADD COLUMN IF NOT EXISTS company_id UUID NULL,
  ADD COLUMN IF NOT EXISTS fatura_tipi TEXT NULL,
  ADD COLUMN IF NOT EXISTS on_odeme_tutar NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS on_odeme_currency TEXT NULL,
  ADD COLUMN IF NOT EXISTS kalan_tutar NUMERIC NULL,
  ADD COLUMN IF NOT EXISTS musteri_telefon TEXT NULL,
  ADD COLUMN IF NOT EXISTS vize_tipleri TEXT[] NULL DEFAULT '{}'::TEXT[],
  ADD COLUMN IF NOT EXISTS tahmini_cikis_tarihi DATE NULL,
  ADD COLUMN IF NOT EXISTS vize_gorseli TEXT NULL,
  ADD COLUMN IF NOT EXISTS eski_pasaport BOOLEAN NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS vize_bitisi_gizli BOOLEAN NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS prim_tarihi DATE NULL,
  ADD COLUMN IF NOT EXISTS gunluk_rapor_gonderildi BOOLEAN NULL DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS takip_no TEXT NULL,
  ADD COLUMN IF NOT EXISTS dogum_tarihi DATE NULL;

DO $$
BEGIN
  IF to_regclass('public.companies') IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM information_schema.table_constraints
      WHERE table_schema = 'public' AND table_name = 'visa_files'
        AND constraint_name = 'visa_files_company_id_fkey'
    ) THEN
      EXECUTE 'ALTER TABLE public.visa_files
               ADD CONSTRAINT visa_files_company_id_fkey
               FOREIGN KEY (company_id) REFERENCES public.companies(id)
               ON DELETE SET NULL';
    END IF;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS visa_files_takip_no_idx     ON public.visa_files(takip_no);
CREATE INDEX IF NOT EXISTS visa_files_company_id_idx   ON public.visa_files(company_id);
CREATE INDEX IF NOT EXISTS visa_files_cari_tipi_idx    ON public.visa_files(cari_tipi);
CREATE INDEX IF NOT EXISTS visa_files_islemden_cikti_idx ON public.visa_files(islemden_cikti);

NOTIFY pgrst, 'reload schema';

COMMIT;
