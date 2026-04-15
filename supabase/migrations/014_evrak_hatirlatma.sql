ALTER TABLE public.randevu_talepleri
  ADD COLUMN IF NOT EXISTS evrak_hatirlatma_gonderildi BOOLEAN DEFAULT FALSE;
