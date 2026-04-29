-- ============================================================
-- 027 — Banka Hesaplari (sirket bazli, dinamik)
--   Eskiden lib/constants.ts'de hardcoded "DAVUT_TURGUT" /
--   "SIRRI_TURGUT" gibi sabit hesap sahipleri vardi. Artik her
--   sirket (organization) Genel Mudur panelinden kendi banka
--   hesaplarini olusturur; personel + admin bu hesaplari dosya
--   olusturma / tahsilat akislarinda secebilir.
--
--   Hareketler ayrica bir tablo gerektirmiyor: payments tablosu
--   hesap_sahibi metnini zaten tutuyor; bank_accounts.id veya
--   bank_accounts.name uzerinden iliskilendiririz.
--
-- Idempotent: tekrar tekrar guvenle calistirilabilir.
-- ============================================================

-- ------------------------------------------------------------
-- 1) Tablo
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.bank_accounts (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  -- Hesap sahibi adi (orn. "Davut Turgut" veya "Genel Ofis Hesabi").
  -- Form'larda "Hesap Sahibi" olarak gosterilir, payments.hesap_sahibi
  -- ile esleserek hareket gecmisini cikartiriz.
  name            TEXT NOT NULL,
  bank_name       TEXT,
  iban            TEXT,
  currency        TEXT NOT NULL DEFAULT 'TL'
    CHECK (currency IN ('TL','EUR','USD')),
  notes           TEXT,
  is_active       BOOLEAN NOT NULL DEFAULT TRUE,
  created_by      UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  CONSTRAINT bank_accounts_unique_name_per_org UNIQUE (organization_id, name)
);

CREATE INDEX IF NOT EXISTS bank_accounts_org_idx
  ON public.bank_accounts (organization_id, is_active);

-- updated_at otomatik
CREATE OR REPLACE FUNCTION public.bank_accounts_set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at := NOW();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS bank_accounts_set_updated_at ON public.bank_accounts;
CREATE TRIGGER bank_accounts_set_updated_at
  BEFORE UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.bank_accounts_set_updated_at();

-- ------------------------------------------------------------
-- 2) RLS
-- ------------------------------------------------------------
ALTER TABLE public.bank_accounts ENABLE ROW LEVEL SECURITY;

-- Yardimci: ayni sirket mi?
-- (tum policy'lerde tekrar tekrar yazmamak icin)
DROP POLICY IF EXISTS "bank_accounts_select_same_org"  ON public.bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_insert_admin"     ON public.bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_update_admin"     ON public.bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_delete_admin"     ON public.bank_accounts;
DROP POLICY IF EXISTS "bank_accounts_platform_owner"   ON public.bank_accounts;

-- Ayni sirketteki herkes (admin, staff, muhasebe) okur
CREATE POLICY "bank_accounts_select_same_org" ON public.bank_accounts
  FOR SELECT TO authenticated
  USING (
    organization_id = (
      SELECT p.organization_id FROM public.profiles p WHERE p.id = auth.uid()
    )
  );

-- Sadece ayni sirketin admin'i (Genel Mudur) ekler
CREATE POLICY "bank_accounts_insert_admin" ON public.bank_accounts
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid()
         AND p.role = 'admin'
         AND p.organization_id = bank_accounts.organization_id
    )
  );

-- Sadece ayni sirketin admin'i guncellenir
CREATE POLICY "bank_accounts_update_admin" ON public.bank_accounts
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid()
         AND p.role = 'admin'
         AND p.organization_id = bank_accounts.organization_id
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid()
         AND p.role = 'admin'
         AND p.organization_id = bank_accounts.organization_id
    )
  );

-- Sadece ayni sirketin admin'i siler (gerekirse soft-delete is_active=false ile)
CREATE POLICY "bank_accounts_delete_admin" ON public.bank_accounts
  FOR DELETE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid()
         AND p.role = 'admin'
         AND p.organization_id = bank_accounts.organization_id
    )
  );

-- Platform owner: tumunu okur (denetim icin)
CREATE POLICY "bank_accounts_platform_owner" ON public.bank_accounts
  FOR SELECT TO authenticated
  USING (public.is_platform_owner());

GRANT SELECT, INSERT, UPDATE, DELETE ON public.bank_accounts TO authenticated;

-- ------------------------------------------------------------
-- 3) PostgREST cache reload
-- ------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
