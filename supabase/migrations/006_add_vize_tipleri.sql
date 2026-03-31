-- Vize tipi seçimleri (3/1, 6/2, MULTI, S, Z, TBD)
ALTER TABLE visa_files ADD COLUMN IF NOT EXISTS vize_tipleri text[] DEFAULT '{}';
