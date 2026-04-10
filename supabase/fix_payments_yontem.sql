-- payments tablosundaki yontem constraint'ini güncelle
-- 'cari' yerine 'hesaba' ekle (kod 'hesaba' kullanıyor)
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_yontem_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_yontem_check CHECK (yontem IN ('nakit', 'hesaba', 'cari', 'pos'));
