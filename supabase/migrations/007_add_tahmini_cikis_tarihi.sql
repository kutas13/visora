-- İşleme girdi butonunda sorulan tahmini çıkış tarihi
ALTER TABLE visa_files ADD COLUMN IF NOT EXISTS tahmini_cikis_tarihi date DEFAULT NULL;
