-- =============================================================================
-- 036 — Vize Dosyası Giderleri (Expenses)
-- =============================================================================
-- Bu migration:
--   1) visa_file_expenses tablosunu oluşturur (her dosyaya bağlı çoklu gider).
--   2) RLS policies (admin tüm giderleri yönetir, staff kendi dosyalarına).
--   3) updated_at trigger.
-- =============================================================================

BEGIN;

CREATE TABLE IF NOT EXISTS public.visa_file_expenses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES public.visa_files(id) ON DELETE CASCADE,
  expense_type TEXT NOT NULL CHECK (expense_type IN (
    'konsolosluk',
    'araci_kurum',
    'saglik_sigortasi',
    'araci_kurum_vip',
    'randevu_vip'
  )),
  amount NUMERIC(12, 2) NOT NULL CHECK (amount >= 0),
  currency TEXT NOT NULL DEFAULT 'TL' CHECK (currency IN ('TL', 'USD', 'EUR')),
  -- Eklendigi an'in TL karsiligi (snapshot). Kullanici doviz girerse o anki
  -- exchange rate ile hesaplanir; sonradan kur degisse bile bu kalir.
  tl_karsilik NUMERIC(12, 2) NULL,
  exchange_rate NUMERIC(12, 4) NULL,
  note TEXT NULL,
  created_by UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Daha onceki migration calistirilmissa eksik kolonlari ekle
ALTER TABLE public.visa_file_expenses
  ADD COLUMN IF NOT EXISTS tl_karsilik NUMERIC(12, 2) NULL,
  ADD COLUMN IF NOT EXISTS exchange_rate NUMERIC(12, 4) NULL;

CREATE INDEX IF NOT EXISTS visa_file_expenses_file_id_idx
  ON public.visa_file_expenses(file_id);

CREATE INDEX IF NOT EXISTS visa_file_expenses_created_at_idx
  ON public.visa_file_expenses(created_at DESC);

-- updated_at otomatik
DROP TRIGGER IF EXISTS visa_file_expenses_updated_at ON public.visa_file_expenses;
CREATE TRIGGER visa_file_expenses_updated_at
  BEFORE UPDATE ON public.visa_file_expenses
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

ALTER TABLE public.visa_file_expenses ENABLE ROW LEVEL SECURITY;

-- Eski policy'leri temizle (idempotent yeniden çalıştırmalar için)
DROP POLICY IF EXISTS "Staff can view expenses of own files" ON public.visa_file_expenses;
DROP POLICY IF EXISTS "Admins can view all expenses" ON public.visa_file_expenses;
DROP POLICY IF EXISTS "Staff can insert expenses for own files" ON public.visa_file_expenses;
DROP POLICY IF EXISTS "Admins can insert any expense" ON public.visa_file_expenses;
DROP POLICY IF EXISTS "Staff can update expenses of own files" ON public.visa_file_expenses;
DROP POLICY IF EXISTS "Admins can update all expenses" ON public.visa_file_expenses;
DROP POLICY IF EXISTS "Staff can delete expenses of own files" ON public.visa_file_expenses;
DROP POLICY IF EXISTS "Admins can delete all expenses" ON public.visa_file_expenses;

-- SELECT: Personel kendi dosyalarının giderlerini görebilir
CREATE POLICY "Staff can view expenses of own files"
  ON public.visa_file_expenses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.visa_files
      WHERE id = visa_file_expenses.file_id
        AND assigned_user_id = auth.uid()
    )
  );

-- SELECT: Admin tüm giderleri görebilir
CREATE POLICY "Admins can view all expenses"
  ON public.visa_file_expenses
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- INSERT: Personel kendi dosyasına gider ekleyebilir
CREATE POLICY "Staff can insert expenses for own files"
  ON public.visa_file_expenses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.visa_files
      WHERE id = visa_file_expenses.file_id
        AND assigned_user_id = auth.uid()
    )
  );

-- INSERT: Admin herhangi bir dosyaya gider ekleyebilir
CREATE POLICY "Admins can insert any expense"
  ON public.visa_file_expenses
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- UPDATE: Personel kendi dosyasının giderini güncelleyebilir
CREATE POLICY "Staff can update expenses of own files"
  ON public.visa_file_expenses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.visa_files
      WHERE id = visa_file_expenses.file_id
        AND assigned_user_id = auth.uid()
    )
  );

-- UPDATE: Admin tüm giderleri güncelleyebilir
CREATE POLICY "Admins can update all expenses"
  ON public.visa_file_expenses
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- DELETE: Personel kendi dosyasının giderini silebilir
CREATE POLICY "Staff can delete expenses of own files"
  ON public.visa_file_expenses
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.visa_files
      WHERE id = visa_file_expenses.file_id
        AND assigned_user_id = auth.uid()
    )
  );

-- DELETE: Admin tüm giderleri silebilir
CREATE POLICY "Admins can delete all expenses"
  ON public.visa_file_expenses
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

NOTIFY pgrst, 'reload schema';

COMMIT;
