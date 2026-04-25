-- Cari sahibi kolonu ekle (Genel Mudur Cari / Personel Cari ayrimi icin)
-- kullanici_cari dosyalarinda Genel Mudur veya personel adi tutulur.

ALTER TABLE public.visa_files 
ADD COLUMN IF NOT EXISTS cari_sahibi TEXT NULL;

COMMENT ON COLUMN public.visa_files.cari_sahibi IS 'Kullanici cari icin: Genel Mudur veya personel adi';
