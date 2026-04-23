-- =========================================================
-- Prim Takibi (Komisyon/Commission)
-- =========================================================
-- 1) Ülke bazlı prim oranları tablosu (herkese ortak)
-- 2) visa_files.prim_tarihi: raporun hangi aya gideceğini belirleyen
--    OPSIYONEL override. NULL ise sonuc_tarihi kullanılır.
-- =========================================================

-- 1) commission_rates tablosu
CREATE TABLE IF NOT EXISTS public.commission_rates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  country TEXT NOT NULL UNIQUE,
  amount NUMERIC(10, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'EUR' CHECK (currency IN ('EUR', 'USD', 'TL')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL
);

COMMENT ON TABLE public.commission_rates IS
  'Ülke bazlı prim oranları. Tüm personel ortak kullanır; biri ekleyince diğerleri de görür.';

-- Index for fast lookups
CREATE INDEX IF NOT EXISTS commission_rates_country_idx ON public.commission_rates (country);

-- 2) visa_files.prim_tarihi (override)
ALTER TABLE public.visa_files
  ADD COLUMN IF NOT EXISTS prim_tarihi DATE;

COMMENT ON COLUMN public.visa_files.prim_tarihi IS
  'Prim raporu için kullanılacak tarih override. NULL ise sonuc_tarihi kullanılır.';

-- 3) RLS: tüm authenticated kullanıcılar okuyabilir ve yazabilir (iç araç)
ALTER TABLE public.commission_rates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "commission_rates_read" ON public.commission_rates;
CREATE POLICY "commission_rates_read"
  ON public.commission_rates
  FOR SELECT
  TO authenticated
  USING (TRUE);

DROP POLICY IF EXISTS "commission_rates_write" ON public.commission_rates;
CREATE POLICY "commission_rates_write"
  ON public.commission_rates
  FOR ALL
  TO authenticated
  USING (TRUE)
  WITH CHECK (TRUE);

-- 4) Varsayılan oranları seed et (Schengen 10 EUR, Çin/ABD 10 EUR, e-vize 5 EUR)
INSERT INTO public.commission_rates (country, amount, currency) VALUES
  -- Schengen
  ('Almanya', 10, 'EUR'),
  ('Fransa', 10, 'EUR'),
  ('İtalya', 10, 'EUR'),
  ('İspanya', 10, 'EUR'),
  ('Hollanda', 10, 'EUR'),
  ('Belçika', 10, 'EUR'),
  ('Avusturya', 10, 'EUR'),
  ('Yunanistan', 10, 'EUR'),
  ('Portekiz', 10, 'EUR'),
  ('İsviçre', 10, 'EUR'),
  ('Polonya', 10, 'EUR'),
  ('Çekya', 10, 'EUR'),
  ('Macaristan', 10, 'EUR'),
  ('Danimarka', 10, 'EUR'),
  ('İsveç', 10, 'EUR'),
  ('Norveç', 10, 'EUR'),
  ('Finlandiya', 10, 'EUR'),
  ('Estonya', 10, 'EUR'),
  ('Letonya', 10, 'EUR'),
  ('Litvanya', 10, 'EUR'),
  ('Slovenya', 10, 'EUR'),
  ('Slovakya', 10, 'EUR'),
  ('Hırvatistan', 10, 'EUR'),
  ('Malta', 10, 'EUR'),
  ('Lüksemburg', 10, 'EUR'),
  ('İzlanda', 10, 'EUR'),
  ('Liechtenstein', 10, 'EUR'),
  -- USD bazlı ülkeler
  ('Çin', 10, 'USD'),
  ('ABD', 10, 'USD')
ON CONFLICT (country) DO NOTHING;

-- Eğer daha önce Çin/ABD EUR olarak eklendiyse USD'ye çevir
UPDATE public.commission_rates SET currency = 'USD'
  WHERE country IN ('Çin', 'ABD') AND currency = 'EUR';

-- 5) schema cache reload
NOTIFY pgrst, 'reload schema';
