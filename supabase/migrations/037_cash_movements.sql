-- =============================================================================
-- 037 — Kasa Hareketleri (Manuel Gelir/Gider)
-- =============================================================================
-- Bu migration:
--   1) cash_movements tablosunu olusturur (her org icin manuel
--      gelir/gider kayitlari — vize dosyasindan bagimsiz).
--   2) organization_id'yi otomatik dolduran trigger.
--   3) RLS policies (admin/muhasebe yonetir, staff goruntuler).
--   4) updated_at trigger.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.cash_movements (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('gelir', 'gider')),
  description TEXT NOT NULL,
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL DEFAULT 'TL' CHECK (currency IN ('TL', 'USD', 'EUR')),
  tl_karsilik NUMERIC(14, 2) NULL,
  exchange_rate NUMERIC(14, 4) NULL,
  category TEXT NULL,
  note TEXT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cash_movements_organization_id_idx
  ON public.cash_movements(organization_id);
CREATE INDEX IF NOT EXISTS cash_movements_type_idx
  ON public.cash_movements(type);
CREATE INDEX IF NOT EXISTS cash_movements_created_at_idx
  ON public.cash_movements(created_at DESC);

CREATE OR REPLACE FUNCTION public.set_cash_movements_org()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.created_by IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM public.profiles WHERE id = NEW.created_by;
  END IF;
  IF NEW.organization_id IS NULL THEN
    SELECT organization_id INTO NEW.organization_id
    FROM public.profiles WHERE id = auth.uid();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS cash_movements_set_org_trg ON public.cash_movements;
CREATE TRIGGER cash_movements_set_org_trg
  BEFORE INSERT OR UPDATE ON public.cash_movements
  FOR EACH ROW EXECUTE FUNCTION public.set_cash_movements_org();

DROP TRIGGER IF EXISTS cash_movements_updated_at ON public.cash_movements;
CREATE TRIGGER cash_movements_updated_at
  BEFORE UPDATE ON public.cash_movements
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.cash_movements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_movements_select_org" ON public.cash_movements;
DROP POLICY IF EXISTS "cash_movements_insert_admin_muhasebe" ON public.cash_movements;
DROP POLICY IF EXISTS "cash_movements_update_admin_muhasebe" ON public.cash_movements;
DROP POLICY IF EXISTS "cash_movements_delete_admin_muhasebe" ON public.cash_movements;

CREATE POLICY "cash_movements_select_org" ON public.cash_movements
  FOR SELECT TO authenticated USING (
    organization_id IS NOT NULL
    AND organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "cash_movements_insert_admin_muhasebe" ON public.cash_movements
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'muhasebe')
    )
  );

CREATE POLICY "cash_movements_update_admin_muhasebe" ON public.cash_movements
  FOR UPDATE TO authenticated USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'muhasebe')
    )
  );

CREATE POLICY "cash_movements_delete_admin_muhasebe" ON public.cash_movements
  FOR DELETE TO authenticated USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'muhasebe')
    )
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
