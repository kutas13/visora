-- =============================================================================
-- 038 — KASA / CÜZDAN MİMARİSİ
-- =============================================================================
-- Bu migration:
--   1) cash_accounts: her org icin nakit (TL/EUR/USD) ve banka kasalari.
--   2) Bootstrap: mevcut organizasyonlara 3 nakit kasasi + banka_hesaplarindan
--      kasalari turetir.
--   3) cash_transactions: tum kasa hareketleri (manual gelir/gider, transfer,
--      odeme tahsilati, dosya gideri).
--   4) Trigger: yeni organizasyon olustugunda 3 nakit kasa otomatik.
--   5) Trigger: bank_accounts INSERT/UPDATE/DELETE -> cash_accounts sync.
--   6) Trigger: payments INSERT/UPDATE/DELETE -> cash_transactions sync.
--   7) Trigger: visa_file_expenses INSERT/UPDATE/DELETE -> cash_transactions sync.
--   8) visa_file_expenses tablosuna kasa secimi (cash_account_id, method).
--   9) RLS: ayni org herkes okur, admin/muhasebe yazabilir.
-- =============================================================================

BEGIN;

-- ---------------------------------------------------------------------------
-- 1) cash_accounts (nakit + banka kasalari)
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cash_accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  kind TEXT NOT NULL CHECK (kind IN ('cash', 'bank')),
  currency TEXT NOT NULL CHECK (currency IN ('TL', 'EUR', 'USD')),
  name TEXT NOT NULL,
  bank_account_id UUID NULL REFERENCES public.bank_accounts(id) ON DELETE CASCADE,
  is_active BOOLEAN NOT NULL DEFAULT TRUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  CONSTRAINT cash_accounts_cash_no_bank
    CHECK ((kind = 'cash' AND bank_account_id IS NULL) OR kind = 'bank')
);

-- nakit kasasi tek tek (org, currency)
CREATE UNIQUE INDEX IF NOT EXISTS cash_accounts_cash_unique
  ON public.cash_accounts (organization_id, currency)
  WHERE kind = 'cash';

-- banka kasasi: her bank_account icin tam 1 kasa
CREATE UNIQUE INDEX IF NOT EXISTS cash_accounts_bank_unique
  ON public.cash_accounts (bank_account_id)
  WHERE kind = 'bank';

CREATE INDEX IF NOT EXISTS cash_accounts_org_idx ON public.cash_accounts (organization_id, is_active);

DROP TRIGGER IF EXISTS cash_accounts_updated_at ON public.cash_accounts;
CREATE TRIGGER cash_accounts_updated_at
  BEFORE UPDATE ON public.cash_accounts
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.cash_accounts ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_accounts_select_org" ON public.cash_accounts;
DROP POLICY IF EXISTS "cash_accounts_insert_admin" ON public.cash_accounts;
DROP POLICY IF EXISTS "cash_accounts_update_admin" ON public.cash_accounts;
DROP POLICY IF EXISTS "cash_accounts_delete_admin" ON public.cash_accounts;

CREATE POLICY "cash_accounts_select_org" ON public.cash_accounts
  FOR SELECT TO authenticated USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "cash_accounts_insert_admin" ON public.cash_accounts
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'muhasebe')
    )
  );

CREATE POLICY "cash_accounts_update_admin" ON public.cash_accounts
  FOR UPDATE TO authenticated USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'muhasebe')
    )
  );

CREATE POLICY "cash_accounts_delete_admin" ON public.cash_accounts
  FOR DELETE TO authenticated USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'muhasebe')
    )
  );

-- ---------------------------------------------------------------------------
-- 2) Bootstrap: mevcut tum org'lar icin 3 nakit kasasi
-- ---------------------------------------------------------------------------
INSERT INTO public.cash_accounts (organization_id, kind, currency, name)
SELECT o.id, 'cash', c.currency, c.currency || ' Nakit Kasası'
FROM public.organizations o
CROSS JOIN (VALUES ('TL'), ('EUR'), ('USD')) AS c(currency)
ON CONFLICT DO NOTHING;

-- Mevcut bank_accounts'tan banka kasalari
INSERT INTO public.cash_accounts (organization_id, kind, currency, name, bank_account_id, is_active)
SELECT ba.organization_id, 'bank', ba.currency,
       COALESCE(NULLIF(ba.bank_name, ''), '') ||
       CASE WHEN ba.bank_name IS NOT NULL AND ba.bank_name <> '' THEN ' — ' ELSE '' END
       || ba.name,
       ba.id, ba.is_active
FROM public.bank_accounts ba
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- 3) Trigger: yeni organization -> 3 nakit kasa
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.create_default_cash_accounts_for_org()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  INSERT INTO public.cash_accounts (organization_id, kind, currency, name)
  VALUES
    (NEW.id, 'cash', 'TL',  'TL Nakit Kasası'),
    (NEW.id, 'cash', 'EUR', 'EUR Nakit Kasası'),
    (NEW.id, 'cash', 'USD', 'USD Nakit Kasası')
  ON CONFLICT DO NOTHING;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS organizations_create_cash_accounts ON public.organizations;
CREATE TRIGGER organizations_create_cash_accounts
  AFTER INSERT ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.create_default_cash_accounts_for_org();

-- ---------------------------------------------------------------------------
-- 4) Trigger: bank_accounts -> cash_accounts sync
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_bank_account_to_cash()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  full_name TEXT;
BEGIN
  IF (TG_OP = 'INSERT') THEN
    full_name := COALESCE(NULLIF(NEW.bank_name, '') || ' — ', '') || NEW.name;
    INSERT INTO public.cash_accounts (organization_id, kind, currency, name, bank_account_id, is_active)
    VALUES (NEW.organization_id, 'bank', NEW.currency, full_name, NEW.id, NEW.is_active)
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  ELSIF (TG_OP = 'UPDATE') THEN
    full_name := COALESCE(NULLIF(NEW.bank_name, '') || ' — ', '') || NEW.name;
    UPDATE public.cash_accounts
    SET name = full_name,
        currency = NEW.currency,
        is_active = NEW.is_active,
        updated_at = NOW()
    WHERE bank_account_id = NEW.id;
    RETURN NEW;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS bank_accounts_sync_cash ON public.bank_accounts;
CREATE TRIGGER bank_accounts_sync_cash
  AFTER INSERT OR UPDATE ON public.bank_accounts
  FOR EACH ROW EXECUTE FUNCTION public.sync_bank_account_to_cash();

-- ---------------------------------------------------------------------------
-- 5) cash_transactions
-- ---------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.cash_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id UUID NOT NULL REFERENCES public.organizations(id) ON DELETE CASCADE,
  account_id UUID NOT NULL REFERENCES public.cash_accounts(id) ON DELETE CASCADE,
  -- Hareket yonu (in: kasaya giriyor, out: kasadan cikiyor)
  direction TEXT NOT NULL CHECK (direction IN ('in', 'out')),
  -- Hareket kaynagi: nereden geldi
  source TEXT NOT NULL CHECK (source IN ('manual', 'payment', 'file_expense', 'transfer')),
  amount NUMERIC(14, 2) NOT NULL CHECK (amount > 0),
  currency TEXT NOT NULL CHECK (currency IN ('TL', 'EUR', 'USD')),
  description TEXT NULL,
  related_payment_id UUID NULL REFERENCES public.payments(id) ON DELETE CASCADE,
  related_file_expense_id UUID NULL REFERENCES public.visa_file_expenses(id) ON DELETE CASCADE,
  -- Transferin diger ucu
  transfer_pair_id UUID NULL,
  transfer_rate NUMERIC(14, 6) NULL,
  created_by UUID NULL REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS cash_transactions_org_idx
  ON public.cash_transactions (organization_id, created_at DESC);
CREATE INDEX IF NOT EXISTS cash_transactions_account_idx
  ON public.cash_transactions (account_id, created_at DESC);
CREATE INDEX IF NOT EXISTS cash_transactions_payment_idx
  ON public.cash_transactions (related_payment_id);
CREATE INDEX IF NOT EXISTS cash_transactions_expense_idx
  ON public.cash_transactions (related_file_expense_id);

-- Tek bir payment'tan birden fazla kayit olusmasin
CREATE UNIQUE INDEX IF NOT EXISTS cash_transactions_payment_uniq
  ON public.cash_transactions (related_payment_id)
  WHERE related_payment_id IS NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS cash_transactions_expense_uniq
  ON public.cash_transactions (related_file_expense_id)
  WHERE related_file_expense_id IS NOT NULL;

ALTER TABLE public.cash_transactions ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "cash_tx_select_org" ON public.cash_transactions;
DROP POLICY IF EXISTS "cash_tx_insert_admin" ON public.cash_transactions;
DROP POLICY IF EXISTS "cash_tx_update_admin" ON public.cash_transactions;
DROP POLICY IF EXISTS "cash_tx_delete_admin" ON public.cash_transactions;

CREATE POLICY "cash_tx_select_org" ON public.cash_transactions
  FOR SELECT TO authenticated USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
  );

CREATE POLICY "cash_tx_insert_admin" ON public.cash_transactions
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'muhasebe', 'staff')
    )
  );

CREATE POLICY "cash_tx_update_admin" ON public.cash_transactions
  FOR UPDATE TO authenticated USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'muhasebe')
    )
  );

CREATE POLICY "cash_tx_delete_admin" ON public.cash_transactions
  FOR DELETE TO authenticated USING (
    organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role IN ('admin', 'muhasebe')
    )
  );

-- ---------------------------------------------------------------------------
-- 6) visa_file_expenses tablosuna kasa secimi
-- ---------------------------------------------------------------------------
ALTER TABLE public.visa_file_expenses
  ADD COLUMN IF NOT EXISTS cash_account_id UUID NULL REFERENCES public.cash_accounts(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS method TEXT NULL CHECK (method IN ('cash', 'bank'));

CREATE INDEX IF NOT EXISTS visa_file_expenses_cash_account_idx
  ON public.visa_file_expenses (cash_account_id);

-- ---------------------------------------------------------------------------
-- 7) payments -> cash_transactions trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_payment_to_cash_tx()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_org UUID;
  v_account UUID;
  v_currency TEXT;
  v_amount NUMERIC;
  v_description TEXT;
  v_file_id UUID;
  v_musteri TEXT;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM public.cash_transactions WHERE related_payment_id = OLD.id;
    RETURN OLD;
  END IF;

  -- Sadece odendi durumunda kasa hareketi olsun
  IF NEW.durum <> 'odendi' THEN
    DELETE FROM public.cash_transactions WHERE related_payment_id = NEW.id;
    RETURN NEW;
  END IF;

  -- file_id'den org cek
  SELECT vf.organization_id, vf.id, vf.musteri_ad
    INTO v_org, v_file_id, v_musteri
  FROM public.visa_files vf WHERE vf.id = NEW.file_id;

  IF v_org IS NULL THEN
    -- Org tespit edilemeyen kayitlari atla
    RETURN NEW;
  END IF;

  v_currency := COALESCE(NEW.currency, 'TL');
  v_amount := NEW.tutar;

  -- POS odemesi: TL nakit kasasina (asil tutar TL'dir; doviz pos_doviz_*)
  IF NEW.yontem = 'pos' THEN
    v_currency := 'TL';
    SELECT id INTO v_account FROM public.cash_accounts
    WHERE organization_id = v_org AND kind = 'cash' AND currency = 'TL' LIMIT 1;
  ELSIF NEW.yontem = 'nakit' THEN
    SELECT id INTO v_account FROM public.cash_accounts
    WHERE organization_id = v_org AND kind = 'cash' AND currency = v_currency LIMIT 1;
  ELSIF NEW.yontem = 'hesaba' AND NEW.hesap_sahibi IS NOT NULL THEN
    SELECT ca.id INTO v_account FROM public.cash_accounts ca
    JOIN public.bank_accounts ba ON ba.id = ca.bank_account_id
    WHERE ca.organization_id = v_org AND ca.kind = 'bank'
      AND ba.name = NEW.hesap_sahibi
    LIMIT 1;
  ELSE
    -- Cari odeme: kasaya yansimaz (tahsilat bekleniyor)
    DELETE FROM public.cash_transactions WHERE related_payment_id = NEW.id;
    RETURN NEW;
  END IF;

  IF v_account IS NULL THEN
    -- Eslesen kasa yok; kayit olusturma (uyari icin loglama eklenebilir)
    DELETE FROM public.cash_transactions WHERE related_payment_id = NEW.id;
    RETURN NEW;
  END IF;

  v_description := COALESCE(v_musteri, 'Müşteri') || ' — '
    || CASE NEW.payment_type
         WHEN 'pesin_satis' THEN 'Peşin Satış'
         WHEN 'tahsilat' THEN 'Tahsilat'
         WHEN 'firma_cari' THEN 'Firma Cari'
         ELSE 'Ödeme'
       END;

  -- Mevcut kayit varsa guncelle, yoksa olustur
  IF EXISTS (SELECT 1 FROM public.cash_transactions WHERE related_payment_id = NEW.id) THEN
    UPDATE public.cash_transactions
       SET account_id = v_account,
           amount = v_amount,
           currency = v_currency,
           description = v_description,
           organization_id = v_org
     WHERE related_payment_id = NEW.id;
  ELSE
    INSERT INTO public.cash_transactions
      (organization_id, account_id, direction, source, amount, currency,
       description, related_payment_id, created_by)
    VALUES
      (v_org, v_account, 'in', 'payment', v_amount, v_currency,
       v_description, NEW.id, NEW.created_by);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS payments_sync_cash_tx ON public.payments;
CREATE TRIGGER payments_sync_cash_tx
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_payment_to_cash_tx();

-- ---------------------------------------------------------------------------
-- 8) visa_file_expenses -> cash_transactions trigger
-- ---------------------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.sync_file_expense_to_cash_tx()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_org UUID;
  v_account UUID;
  v_description TEXT;
  v_musteri TEXT;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM public.cash_transactions WHERE related_file_expense_id = OLD.id;
    RETURN OLD;
  END IF;

  IF NEW.cash_account_id IS NULL THEN
    -- Kasa secilmemis: hareket olusturma
    DELETE FROM public.cash_transactions WHERE related_file_expense_id = NEW.id;
    RETURN NEW;
  END IF;

  SELECT vf.organization_id, vf.musteri_ad
    INTO v_org, v_musteri
  FROM public.visa_files vf WHERE vf.id = NEW.file_id;

  IF v_org IS NULL THEN
    RETURN NEW;
  END IF;

  v_description := COALESCE(v_musteri, 'Müşteri') || ' — Dosya Gideri ('
    || CASE NEW.expense_type
         WHEN 'konsolosluk' THEN 'Konsolosluk'
         WHEN 'araci_kurum' THEN 'Aracı Kurum'
         WHEN 'saglik_sigortasi' THEN 'Sağlık Sigortası'
         WHEN 'araci_kurum_vip' THEN 'Aracı Kurum VIP'
         WHEN 'randevu_vip' THEN 'Randevu VIP'
         ELSE NEW.expense_type
       END
    || ')';

  IF EXISTS (SELECT 1 FROM public.cash_transactions WHERE related_file_expense_id = NEW.id) THEN
    UPDATE public.cash_transactions
       SET account_id = NEW.cash_account_id,
           amount = NEW.amount,
           currency = NEW.currency,
           description = v_description,
           organization_id = v_org
     WHERE related_file_expense_id = NEW.id;
  ELSE
    INSERT INTO public.cash_transactions
      (organization_id, account_id, direction, source, amount, currency,
       description, related_file_expense_id, created_by)
    VALUES
      (v_org, NEW.cash_account_id, 'out', 'file_expense', NEW.amount,
       NEW.currency, v_description, NEW.id, NEW.created_by);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS visa_file_expenses_sync_cash_tx ON public.visa_file_expenses;
CREATE TRIGGER visa_file_expenses_sync_cash_tx
  AFTER INSERT OR UPDATE OR DELETE ON public.visa_file_expenses
  FOR EACH ROW EXECUTE FUNCTION public.sync_file_expense_to_cash_tx();

-- ---------------------------------------------------------------------------
-- 9) Mevcut payments verisini cash_transactions'a backfill
-- ---------------------------------------------------------------------------
INSERT INTO public.cash_transactions
  (organization_id, account_id, direction, source, amount, currency,
   description, related_payment_id, created_by, created_at)
SELECT
  vf.organization_id,
  CASE
    WHEN p.yontem = 'pos' THEN
      (SELECT id FROM public.cash_accounts
       WHERE organization_id = vf.organization_id AND kind = 'cash' AND currency = 'TL' LIMIT 1)
    WHEN p.yontem = 'nakit' THEN
      (SELECT id FROM public.cash_accounts
       WHERE organization_id = vf.organization_id AND kind = 'cash'
         AND currency = COALESCE(p.currency, 'TL') LIMIT 1)
    WHEN p.yontem = 'hesaba' THEN
      (SELECT ca.id FROM public.cash_accounts ca
       JOIN public.bank_accounts ba ON ba.id = ca.bank_account_id
       WHERE ca.organization_id = vf.organization_id AND ca.kind = 'bank'
         AND ba.name = p.hesap_sahibi LIMIT 1)
  END AS account_id,
  'in' AS direction,
  'payment' AS source,
  p.tutar,
  CASE WHEN p.yontem = 'pos' THEN 'TL' ELSE COALESCE(p.currency, 'TL') END,
  COALESCE(vf.musteri_ad, 'Müşteri') || ' — '
    || CASE p.payment_type
         WHEN 'pesin_satis' THEN 'Peşin Satış'
         WHEN 'tahsilat' THEN 'Tahsilat'
         WHEN 'firma_cari' THEN 'Firma Cari'
         ELSE 'Ödeme'
       END,
  p.id,
  p.created_by,
  p.created_at
FROM public.payments p
JOIN public.visa_files vf ON vf.id = p.file_id
WHERE p.durum = 'odendi'
  AND p.yontem IN ('nakit', 'hesaba', 'pos')
  AND NOT EXISTS (
    SELECT 1 FROM public.cash_transactions ct WHERE ct.related_payment_id = p.id
  );

-- account_id NULL olan kayitlari (eslesemedi) sil
DELETE FROM public.cash_transactions WHERE account_id IS NULL;

NOTIFY pgrst, 'reload schema';

COMMIT;
