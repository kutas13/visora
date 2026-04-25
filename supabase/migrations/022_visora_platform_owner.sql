-- ============================================================
-- Visora Platform Owner (sahip) paneli
-- Sirketler, abonelikler, aylik odeme takibi, sistem cirosu
-- ============================================================

-- ------------------------------------------------------------
-- 1) profiles.role'e 'platform_owner' rolunu ekle
-- ------------------------------------------------------------
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;

-- Once eski/bos/bilinmeyen role degerlerini temizle ki yeni CHECK sorunsuz eklensin.
-- NULL veya tanimsiz roller -> varsayilan 'staff'
UPDATE public.profiles
   SET role = 'staff'
 WHERE role IS NULL
    OR role NOT IN ('admin', 'staff', 'muhasebe', 'platform_owner');

ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'staff', 'muhasebe', 'platform_owner'));

-- Platform owner organization_id'siz olabilir; admin tekligi yalnizca admin icin gecerli (zaten oyle)

-- ------------------------------------------------------------
-- 2) Yardimci: caller platform owner mi?
--    SECURITY DEFINER + STABLE -> RLS icinde guvenli kullanim
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.is_platform_owner()
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $ipo$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'platform_owner'
  );
$ipo$;

GRANT EXECUTE ON FUNCTION public.is_platform_owner() TO authenticated, anon;

-- ------------------------------------------------------------
-- 3) organizations icin EK ALANLAR (plan, abonelik durumu)
-- ------------------------------------------------------------
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS slug TEXT,
  ADD COLUMN IF NOT EXISTS billing_email TEXT,
  ADD COLUMN IF NOT EXISTS phone TEXT,
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS notes TEXT;

-- status: active | suspended | cancelled
ALTER TABLE public.organizations DROP CONSTRAINT IF EXISTS organizations_status_check;
ALTER TABLE public.organizations ADD CONSTRAINT organizations_status_check
  CHECK (status IN ('active', 'suspended', 'cancelled'));

-- platform_owner her sirketi gorebilsin/yazabilsin
DROP POLICY IF EXISTS "organizations_owner_all" ON public.organizations;
CREATE POLICY "organizations_owner_all" ON public.organizations
  FOR ALL TO authenticated
  USING (public.is_platform_owner())
  WITH CHECK (public.is_platform_owner());

-- ------------------------------------------------------------
-- 4) platform_subscriptions: firma basi aylik ucret/plan
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  monthly_fee NUMERIC(12, 2) NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'TRY',
  plan_name TEXT NOT NULL DEFAULT 'standart',
  started_at DATE NOT NULL DEFAULT CURRENT_DATE,
  status TEXT NOT NULL DEFAULT 'active',
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id)
);

ALTER TABLE public.platform_subscriptions DROP CONSTRAINT IF EXISTS platform_subscriptions_status_check;
ALTER TABLE public.platform_subscriptions ADD CONSTRAINT platform_subscriptions_status_check
  CHECK (status IN ('active', 'paused', 'cancelled'));

ALTER TABLE public.platform_subscriptions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_subscriptions_owner_all" ON public.platform_subscriptions;
CREATE POLICY "platform_subscriptions_owner_all" ON public.platform_subscriptions
  FOR ALL TO authenticated
  USING (public.is_platform_owner())
  WITH CHECK (public.is_platform_owner());

-- Genel mudur kendi aboneligini sadece okuyabilsin
DROP POLICY IF EXISTS "platform_subscriptions_admin_read_own" ON public.platform_subscriptions;
CREATE POLICY "platform_subscriptions_admin_read_own" ON public.platform_subscriptions
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin' AND organization_id IS NOT NULL
    )
  );

-- ------------------------------------------------------------
-- 5) platform_payments: aylik odeme kayitlari
--    Her organization * (yil, ay) tek satir
-- ------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.platform_payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  period_year INT NOT NULL,
  period_month INT NOT NULL CHECK (period_month BETWEEN 1 AND 12),
  amount NUMERIC(12, 2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'TRY',
  paid BOOLEAN NOT NULL DEFAULT false,
  paid_at TIMESTAMPTZ,
  payment_method TEXT,
  note TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (organization_id, period_year, period_month)
);

CREATE INDEX IF NOT EXISTS platform_payments_period_idx
  ON public.platform_payments (period_year DESC, period_month DESC);

CREATE INDEX IF NOT EXISTS platform_payments_org_idx
  ON public.platform_payments (organization_id);

ALTER TABLE public.platform_payments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "platform_payments_owner_all" ON public.platform_payments;
CREATE POLICY "platform_payments_owner_all" ON public.platform_payments
  FOR ALL TO authenticated
  USING (public.is_platform_owner())
  WITH CHECK (public.is_platform_owner());

DROP POLICY IF EXISTS "platform_payments_admin_read_own" ON public.platform_payments;
CREATE POLICY "platform_payments_admin_read_own" ON public.platform_payments
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin' AND organization_id IS NOT NULL
    )
  );

-- ------------------------------------------------------------
-- 6) updated_at trigger'lari
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.touch_updated_at()
RETURNS TRIGGER AS $tua$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$tua$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS platform_subscriptions_touch_updated ON public.platform_subscriptions;
CREATE TRIGGER platform_subscriptions_touch_updated
  BEFORE UPDATE ON public.platform_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

DROP TRIGGER IF EXISTS platform_payments_touch_updated ON public.platform_payments;
CREATE TRIGGER platform_payments_touch_updated
  BEFORE UPDATE ON public.platform_payments
  FOR EACH ROW EXECUTE FUNCTION public.touch_updated_at();

-- ------------------------------------------------------------
-- 7) Yardimci: bir firma icin ay ay tahakkuk olustur
--    (Genelde aboneligin baslangicindan bu yana her ay icin
--     bir platform_payments kaydi acmak icin manuel cagrilir)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_platform_invoices(p_organization_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $epi$
DECLARE
  sub RECORD;
  cur_y INT;
  cur_m INT;
  iter DATE;
  end_d DATE;
  inserted_count INT := 0;
BEGIN
  IF NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  SELECT * INTO sub FROM public.platform_subscriptions WHERE organization_id = p_organization_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  iter := date_trunc('month', sub.started_at)::date;
  end_d := date_trunc('month', CURRENT_DATE)::date;

  WHILE iter <= end_d LOOP
    cur_y := EXTRACT(YEAR FROM iter)::INT;
    cur_m := EXTRACT(MONTH FROM iter)::INT;

    INSERT INTO public.platform_payments (organization_id, period_year, period_month, amount, currency)
    VALUES (p_organization_id, cur_y, cur_m, sub.monthly_fee, sub.currency)
    ON CONFLICT (organization_id, period_year, period_month) DO NOTHING;

    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    iter := (iter + INTERVAL '1 month')::date;
  END LOOP;

  RETURN inserted_count;
END;
$epi$;

GRANT EXECUTE ON FUNCTION public.ensure_platform_invoices(UUID) TO authenticated;

-- ------------------------------------------------------------
-- 8) Tum aktif firmalar icin tahakkuk uretici (toplu)
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_all_platform_invoices()
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $eapi$
DECLARE
  org_row RECORD;
  total INT := 0;
  added INT := 0;
BEGIN
  IF NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  FOR org_row IN
    SELECT s.organization_id
    FROM public.platform_subscriptions s
    JOIN public.organizations o ON o.id = s.organization_id
    WHERE s.status = 'active' AND o.status = 'active'
  LOOP
    SELECT public.ensure_platform_invoices(org_row.organization_id) INTO added;
    total := total + COALESCE(added, 0);
  END LOOP;

  RETURN total;
END;
$eapi$;

GRANT EXECUTE ON FUNCTION public.ensure_all_platform_invoices() TO authenticated;

-- ------------------------------------------------------------
-- 9) Sistem geliri ozeti (view-benzeri fonksiyon)
--    platform_owner icin son 24 ayin toplamlarini doner
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.platform_revenue_monthly(p_months INT DEFAULT 12)
RETURNS TABLE (
  period_year INT,
  period_month INT,
  paid_total NUMERIC,
  unpaid_total NUMERIC,
  paid_count INT,
  unpaid_count INT
)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $prm$
  WITH bounds AS (
    SELECT
      EXTRACT(YEAR  FROM (date_trunc('month', CURRENT_DATE) - ((p_months - 1) || ' months')::interval))::INT  AS y0,
      EXTRACT(MONTH FROM (date_trunc('month', CURRENT_DATE) - ((p_months - 1) || ' months')::interval))::INT AS m0
  )
  SELECT
    p.period_year,
    p.period_month,
    COALESCE(SUM(CASE WHEN p.paid     THEN p.amount END), 0) AS paid_total,
    COALESCE(SUM(CASE WHEN NOT p.paid THEN p.amount END), 0) AS unpaid_total,
    COUNT(*) FILTER (WHERE p.paid)         AS paid_count,
    COUNT(*) FILTER (WHERE NOT p.paid)     AS unpaid_count
  FROM public.platform_payments p
  WHERE public.is_platform_owner()
    AND (p.period_year * 100 + p.period_month) >=
        ((SELECT y0 FROM bounds) * 100 + (SELECT m0 FROM bounds))
  GROUP BY p.period_year, p.period_month
  ORDER BY p.period_year DESC, p.period_month DESC;
$prm$;

GRANT EXECUTE ON FUNCTION public.platform_revenue_monthly(INT) TO authenticated;
