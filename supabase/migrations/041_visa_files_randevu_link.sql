-- ---------------------------------------------------------------------------
-- 041: visa_files <-> randevu_talepleri baglanti kolonu.
-- Randevu Al ile otomatik olusan dosyalari kaynak talebe baglar.
-- Boylece takvim ekraninda ayni talep icin hem dosyalar hem talep duplicate
-- olarak gozukmesin (dedup edilir).
-- ---------------------------------------------------------------------------

ALTER TABLE public.visa_files
  ADD COLUMN IF NOT EXISTS randevu_talebi_id UUID NULL
    REFERENCES public.randevu_talepleri(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS visa_files_randevu_talebi_idx
  ON public.visa_files (randevu_talebi_id);

NOTIFY pgrst, 'reload schema';
