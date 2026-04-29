-- ============================================================
-- 028 — payments tablosuna hesap_sahibi + dekont_url
--
-- Banka Hesaplari sayfasinda hesap gecmisini cikarabilmek icin
-- her odeme satirinda HANGI hesaba gittigini bilmek gerekiyor.
-- Onceden yalniz visa_files.hesap_sahibi tutuluyordu; artik tahsilat
-- (her tutar farkli hesaba gidebilir) bazinda da kayit altinda.
--
-- Ayrica "hesaba" yontemiyle alinan odemelerde yuklenen dekontu
-- payments.dekont_url ile saklayip Banka Hesaplari sayfasinda
-- "Dekont gor" linki olarak sunabilelim.
--
-- Idempotent: tekrar tekrar guvenle calistirilabilir.
-- ============================================================

ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS hesap_sahibi TEXT NULL,
  ADD COLUMN IF NOT EXISTS dekont_url   TEXT NULL;

COMMENT ON COLUMN public.payments.hesap_sahibi IS
  'Hangi banka hesabina yatti (bank_accounts.name). Yalniz yontem=hesaba icin doludur.';
COMMENT ON COLUMN public.payments.dekont_url IS
  'Yuklenen dekont icin public storage URL. Yalniz yontem=hesaba icin doludur.';

-- Hesap gecmisi sorgularinda kullanilan filtreyi hizlandir
CREATE INDEX IF NOT EXISTS payments_hesap_sahibi_created_idx
  ON public.payments (hesap_sahibi, created_at DESC)
  WHERE hesap_sahibi IS NOT NULL;

NOTIFY pgrst, 'reload schema';
