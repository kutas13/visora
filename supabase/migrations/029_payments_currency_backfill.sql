-- ============================================================
-- 029 — payments tablosunda eksik kolonlari tamamla
--
-- Bazı ortamlarda payments tablosu eski şemada kalmış olabilir.
-- Uygulama currency/payment_type gibi kolonları kullandığı için
-- PostgREST "Could not find ... in schema cache" hatası verebilir.
--
-- Bu migration eksik kolonları idempotent şekilde ekler ve
-- mevcut satırları makul default değerlerle doldurur.
-- ============================================================

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS currency TEXT,
  ADD COLUMN IF NOT EXISTS payment_type TEXT,
  ADD COLUMN IF NOT EXISTS pos_doviz_tutar NUMERIC,
  ADD COLUMN IF NOT EXISTS pos_doviz_currency TEXT,
  ADD COLUMN IF NOT EXISTS hesap_sahibi TEXT,
  ADD COLUMN IF NOT EXISTS dekont_url TEXT;

-- Eski kayıtları boş bırakmamak için default/backfill
UPDATE public.payments p
SET
  currency = COALESCE(
    p.currency,
    vf.ucret_currency,
    'TL'
  ),
  payment_type = COALESCE(
    p.payment_type,
    CASE
      WHEN vf.odeme_plani = 'pesin' THEN 'pesin_satis'
      ELSE 'tahsilat'
    END
  )
FROM public.visa_files vf
WHERE p.file_id = vf.id
  AND (p.currency IS NULL OR p.payment_type IS NULL);

-- Hala null kalanlar için son güvenlik
UPDATE public.payments
SET currency = 'TL'
WHERE currency IS NULL;

UPDATE public.payments
SET payment_type = 'tahsilat'
WHERE payment_type IS NULL;

CREATE INDEX IF NOT EXISTS payments_currency_idx
  ON public.payments (currency);

CREATE INDEX IF NOT EXISTS payments_payment_type_idx
  ON public.payments (payment_type);

NOTIFY pgrst, 'reload schema';
