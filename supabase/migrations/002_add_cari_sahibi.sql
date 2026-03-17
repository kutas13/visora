-- Cari sahibi kolonu ekle (Davut Cari / Kullanıcı Cari ayrımı için)
-- kullanici_cari dosyalarında: "DAVUT" veya personel adı (örn. "YUSUF")

ALTER TABLE public.visa_files 
ADD COLUMN IF NOT EXISTS cari_sahibi TEXT NULL;

COMMENT ON COLUMN public.visa_files.cari_sahibi IS 'Kullanıcı cari için: DAVUT veya personel adı';
