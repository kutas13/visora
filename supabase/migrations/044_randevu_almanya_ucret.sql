-- ============================================================
-- 044 — randevu_talepleri: Almanya ucret bilgileri
--
-- Almanya icin odenecek konsolosluk ucreti artik "Randevu Al" anida
-- degil, randevu talebi olusturulurken giriliyor. Bu degerler talepte
-- saklanir; randevu al asamasinda otomatik olarak pasaport sayisina
-- bolunup konsolosluk gideri olarak vize dosyasina yazilir.
-- Idempotent.
-- ============================================================

ALTER TABLE public.randevu_talepleri
  ADD COLUMN IF NOT EXISTS almanya_ucret NUMERIC(14,2) NULL,
  ADD COLUMN IF NOT EXISTS almanya_ucret_currency TEXT NULL
    CHECK (almanya_ucret_currency IS NULL OR almanya_ucret_currency IN ('TL','EUR','USD')),
  ADD COLUMN IF NOT EXISTS almanya_cash_account_id UUID NULL
    REFERENCES public.cash_accounts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS randevu_talepleri_almanya_acct_idx
  ON public.randevu_talepleri (almanya_cash_account_id);

NOTIFY pgrst, 'reload schema';
