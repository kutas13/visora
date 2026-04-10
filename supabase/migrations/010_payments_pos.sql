-- POS ödeme yöntemi + kart dövizi bilgisi (hesaba yansıyan tutar TL olarak payments.tutar)
ALTER TABLE public.payments DROP CONSTRAINT IF EXISTS payments_yontem_check;
ALTER TABLE public.payments ADD CONSTRAINT payments_yontem_check CHECK (yontem IN ('nakit', 'hesaba', 'cari', 'pos'));

ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS pos_doviz_tutar NUMERIC;
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS pos_doviz_currency TEXT;
