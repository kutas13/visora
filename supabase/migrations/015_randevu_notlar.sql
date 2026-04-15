ALTER TABLE public.randevu_talepleri
  ADD COLUMN IF NOT EXISTS notlar TEXT DEFAULT NULL;
