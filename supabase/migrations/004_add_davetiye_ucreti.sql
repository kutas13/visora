ALTER TABLE public.visa_files
ADD COLUMN IF NOT EXISTS davetiye_ucreti NUMERIC NULL,
ADD COLUMN IF NOT EXISTS davetiye_ucreti_currency TEXT NULL
  CHECK (davetiye_ucreti_currency IN ('TL', 'EUR', 'USD'));
