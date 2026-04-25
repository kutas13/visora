-- =============================================================================
-- 024 — visa_files icin eksik kolonlar + Vize Sonuc Takip alanlari
-- =============================================================================
-- Bu migration:
--   1) Kodda kullanilan ama eski veritabaninda eksik kalmis kolonlari ekler
--      (ucret, ucret_currency, odeme_durumu, cari_tipi, cari_sahibi,
--       hesap_sahibi, company_id, fatura_tipi, on_odeme_*, kalan_tutar,
--       musteri_telefon, gunluk_rapor_gonderildi, odeme_plani vb.)
--   2) Yeni "Vize Sonuc Takip" sayfasi icin gerekli alanlari ekler:
--      - takip_no  (vize merkezinin takip numarasi)
--      - dogum_tarihi (musteri dogum tarihi)
--   3) Hepsi IF NOT EXISTS ile guvenli; tekrar tekrar calistirilabilir.
-- =============================================================================

BEGIN;

-- ── visa_files: eksik kolonlar ────────────────────────────────────────────────
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
  -- yeni: vize sonuc takip alanlari
  ADD COLUMN IF NOT EXISTS takip_no TEXT NULL,
  ADD COLUMN IF NOT EXISTS dogum_tarihi DATE NULL;

-- ── companies FK (opsiyonel; companies tablosu varsa baglar) ─────────────────
DO $$
BEGIN
  IF to_regclass('public.companies') IS NOT NULL THEN
    -- mevcut FK varsa dokunma
    IF NOT EXISTS (
      SELECT 1
      FROM information_schema.table_constraints
      WHERE table_schema = 'public'
        AND table_name   = 'visa_files'
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

-- ── Mantiksal CHECK kisitlari (yumusak; sadece eksikse ekle) ─────────────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name   = 'visa_files'
      AND constraint_name = 'visa_files_odeme_durumu_chk'
  ) THEN
    EXECUTE 'ALTER TABLE public.visa_files
             ADD CONSTRAINT visa_files_odeme_durumu_chk
             CHECK (odeme_durumu IS NULL OR odeme_durumu IN (''odendi'',''odenmedi''))';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name   = 'visa_files'
      AND constraint_name = 'visa_files_odeme_plani_chk'
  ) THEN
    EXECUTE 'ALTER TABLE public.visa_files
             ADD CONSTRAINT visa_files_odeme_plani_chk
             CHECK (odeme_plani IS NULL OR odeme_plani IN (''pesin'',''cari''))';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name   = 'visa_files'
      AND constraint_name = 'visa_files_cari_tipi_chk'
  ) THEN
    EXECUTE 'ALTER TABLE public.visa_files
             ADD CONSTRAINT visa_files_cari_tipi_chk
             CHECK (cari_tipi IS NULL OR cari_tipi IN (''kullanici_cari'',''firma_cari''))';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name   = 'visa_files'
      AND constraint_name = 'visa_files_fatura_tipi_chk'
  ) THEN
    EXECUTE 'ALTER TABLE public.visa_files
             ADD CONSTRAINT visa_files_fatura_tipi_chk
             CHECK (fatura_tipi IS NULL OR fatura_tipi IN (''isimli'',''isimsiz''))';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE table_schema = 'public'
      AND table_name   = 'visa_files'
      AND constraint_name = 'visa_files_currency_chk'
  ) THEN
    EXECUTE 'ALTER TABLE public.visa_files
             ADD CONSTRAINT visa_files_currency_chk
             CHECK (ucret_currency IS NULL OR ucret_currency IN (''TL'',''EUR'',''USD''))';
  END IF;
END
$$;

-- ── Indexler ────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS visa_files_takip_no_idx     ON public.visa_files(takip_no);
CREATE INDEX IF NOT EXISTS visa_files_company_id_idx   ON public.visa_files(company_id);
CREATE INDEX IF NOT EXISTS visa_files_cari_tipi_idx    ON public.visa_files(cari_tipi);
CREATE INDEX IF NOT EXISTS visa_files_islemden_cikti_idx ON public.visa_files(islemden_cikti);

-- ── Supabase PostgREST schema cache'ini yenile ───────────────────────────────
NOTIFY pgrst, 'reload schema';

COMMIT;

-- =============================================================================
-- BITTI: Yeni dosya formu artik cari_tipi/ucret/odeme_durumu/takip_no/
--        dogum_tarihi kolonlarina yazabilir.
-- =============================================================================
