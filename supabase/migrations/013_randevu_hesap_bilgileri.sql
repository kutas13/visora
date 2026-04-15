-- Randevu talepleri: ulkeye ozel hesap bilgileri + hatirlatma takibi
ALTER TABLE public.randevu_talepleri
  ADD COLUMN IF NOT EXISTS hesap_bilgileri JSONB DEFAULT NULL,
  ADD COLUMN IF NOT EXISTS son_hesap_hatirlatma TIMESTAMPTZ DEFAULT NULL;
