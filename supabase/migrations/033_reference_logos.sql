-- 033: Ana sayfadaki referans logoları
-- Owner aktif şirketlerden seçip logo yükleyebilir, ana sayfada dönen slider'da gösterilir.

CREATE TABLE IF NOT EXISTS public.reference_logos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  company_name TEXT NOT NULL,
  logo_url TEXT NOT NULL,
  sort_order INT NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.reference_logos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can view active reference logos"
  ON public.reference_logos FOR SELECT
  USING (is_active = true);

CREATE POLICY "Platform owner can manage reference logos"
  ON public.reference_logos FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'platform_owner'
    )
  );

-- Spyke Turizm ilk referans logosu
INSERT INTO public.reference_logos (company_name, logo_url, sort_order, is_active)
VALUES ('Spyke Turizm', '/references/spyke-turizm.png', 0, true)
ON CONFLICT DO NOTHING;
