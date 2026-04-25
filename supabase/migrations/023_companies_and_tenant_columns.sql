-- ============================================================
-- 023 — Companies (cari firmalar) tablosu + tenant izolasyonu
--       ve gerekli yardimci kolonlar.
-- ============================================================
-- Bu migration:
--   1) public.companies tablosunu olusturur (yoksa) ve
--      organization_id sutunu + RLS ekler.
--   2) Sik kullanilan tablolara organization_id kolonu ekler ve
--      otomatik dolduran trigger'lar takar (boylece her sirketin
--      verisi kendi org_id'sine baglanir).
-- Idempotent: tekrar tekrar guvenle calistirilabilir.
-- ============================================================

-- ------------------------------------------------------------
-- 1) public.companies
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.companies (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  firma_adi TEXT NOT NULL,
  vergi_no TEXT,
  telefon TEXT,
  adres TEXT,
  notlar TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE
);

ALTER TABLE public.companies
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS companies_organization_id_idx
  ON public.companies (organization_id);
CREATE UNIQUE INDEX IF NOT EXISTS companies_org_firma_uniq
  ON public.companies (organization_id, lower(firma_adi));

ALTER TABLE public.companies ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "companies_select_org" ON public.companies;
DROP POLICY IF EXISTS "companies_insert_org" ON public.companies;
DROP POLICY IF EXISTS "companies_update_org" ON public.companies;
DROP POLICY IF EXISTS "companies_delete_admin_org" ON public.companies;

CREATE POLICY "companies_select_org" ON public.companies
  FOR SELECT TO authenticated USING (
    organization_id IS NOT NULL
    AND organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "companies_insert_org" ON public.companies
  FOR INSERT TO authenticated WITH CHECK (
    organization_id IS NOT NULL
    AND organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "companies_update_org" ON public.companies
  FOR UPDATE TO authenticated USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "companies_delete_admin_org" ON public.companies
  FOR DELETE TO authenticated USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin','muhasebe')
    )
  );

-- ------------------------------------------------------------
-- 2) Diger tablolar icin organization_id kolonlari + auto-fill
-- ------------------------------------------------------------

-- visa_files
ALTER TABLE public.visa_files
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

UPDATE public.visa_files vf
SET organization_id = p.organization_id
FROM public.profiles p
WHERE vf.assigned_user_id = p.id
  AND vf.organization_id IS NULL
  AND p.organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS visa_files_organization_id_idx
  ON public.visa_files (organization_id);

CREATE OR REPLACE FUNCTION public.set_visa_files_org()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.assigned_user_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM public.profiles WHERE id = NEW.assigned_user_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS visa_files_set_org_trg ON public.visa_files;
CREATE TRIGGER visa_files_set_org_trg
  BEFORE INSERT OR UPDATE ON public.visa_files
  FOR EACH ROW EXECUTE FUNCTION public.set_visa_files_org();

-- payments
ALTER TABLE public.payments
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

UPDATE public.payments pa
SET organization_id = vf.organization_id
FROM public.visa_files vf
WHERE pa.file_id = vf.id
  AND pa.organization_id IS NULL
  AND vf.organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS payments_organization_id_idx
  ON public.payments (organization_id);

CREATE OR REPLACE FUNCTION public.set_payments_org()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.file_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM public.visa_files WHERE id = NEW.file_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS payments_set_org_trg ON public.payments;
CREATE TRIGGER payments_set_org_trg
  BEFORE INSERT OR UPDATE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.set_payments_org();

-- daily_reports (varsa)
DO $dr$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'daily_reports'
  ) THEN
    ALTER TABLE public.daily_reports
      ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

    UPDATE public.daily_reports dr
    SET organization_id = p.organization_id
    FROM public.profiles p
    WHERE dr.user_id = p.id
      AND dr.organization_id IS NULL
      AND p.organization_id IS NOT NULL;

    CREATE INDEX IF NOT EXISTS daily_reports_organization_id_idx
      ON public.daily_reports (organization_id);

    CREATE OR REPLACE FUNCTION public.set_daily_reports_org()
    RETURNS TRIGGER AS $body$
    BEGIN
      IF NEW.organization_id IS NULL AND NEW.user_id IS NOT NULL THEN
        SELECT organization_id INTO NEW.organization_id
        FROM public.profiles WHERE id = NEW.user_id;
      END IF;
      RETURN NEW;
    END;
    $body$ LANGUAGE plpgsql SECURITY DEFINER;

    DROP TRIGGER IF EXISTS daily_reports_set_org_trg ON public.daily_reports;
    CREATE TRIGGER daily_reports_set_org_trg
      BEFORE INSERT OR UPDATE ON public.daily_reports
      FOR EACH ROW EXECUTE FUNCTION public.set_daily_reports_org();
  END IF;
END $dr$;

-- activity_logs (actor_id var; trigger ile org doldur)
ALTER TABLE public.activity_logs
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

UPDATE public.activity_logs al
SET organization_id = p.organization_id
FROM public.profiles p
WHERE al.actor_id = p.id
  AND al.organization_id IS NULL
  AND p.organization_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS activity_logs_organization_id_idx
  ON public.activity_logs (organization_id);

CREATE OR REPLACE FUNCTION public.set_activity_logs_org()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.actor_id IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM public.profiles WHERE id = NEW.actor_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS activity_logs_set_org_trg ON public.activity_logs;
CREATE TRIGGER activity_logs_set_org_trg
  BEFORE INSERT OR UPDATE ON public.activity_logs
  FOR EACH ROW EXECUTE FUNCTION public.set_activity_logs_org();

-- ------------------------------------------------------------
-- 3) PostgREST cache reload
-- ------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
