-- ============================================================
-- 030 — payments tablosuna tl_karsilik kolonu
--
-- Senaryo: Dosya USD/EUR cinsinden ama musteri TL olarak odedi.
--   Kasada/raporlarda bu odeme TL olarak degil dosyanin orijinal
--   currency'sinde gorunsun (300 USD), yaninda kucuk bir not
--   olsun: "TL karsiligi: 12.000 ₺".
--
-- payment kaydi:
--   tutar    = orijinal currency cinsinden (USD)
--   currency = orijinal currency           (USD)
--   tl_karsilik = TL olarak alinan tutar    (12000)
--
-- POS akisi pos_doviz_tutar/currency ile devam eder; bu kolon
-- onun yerine gecmez, sadece nakit/hesaba TL alindi senaryosu.
--
-- Idempotent: tekrar tekrar guvenle calistirilabilir.
-- ============================================================

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS tl_karsilik NUMERIC NULL;

COMMENT ON COLUMN public.payments.tl_karsilik IS
  'Dosya farkli currency olup TL olarak tahsil edildiginde gercekte alinan TL tutar.';

CREATE INDEX IF NOT EXISTS payments_tl_karsilik_idx
  ON public.payments (tl_karsilik)
  WHERE tl_karsilik IS NOT NULL;

NOTIFY pgrst, 'reload schema';
