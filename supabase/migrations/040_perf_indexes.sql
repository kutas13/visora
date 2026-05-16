-- ---------------------------------------------------------------------------
-- 040: Performans icin gerekli indeksler.
-- Sayfa yuklemeleri sirasinda en sik kullanilan sorgulari hizlandirir.
-- ---------------------------------------------------------------------------

-- visa_files: en sik sorgulanan kolonlar (org + tarih, atanan personel, sonuc)
CREATE INDEX IF NOT EXISTS visa_files_org_created_idx
  ON public.visa_files (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS visa_files_assigned_created_idx
  ON public.visa_files (assigned_user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS visa_files_sonuc_idx
  ON public.visa_files (organization_id, sonuc, created_at DESC);

CREATE INDEX IF NOT EXISTS visa_files_islemden_idx
  ON public.visa_files (organization_id, islemden_cikti, islemden_cikti_at DESC);

-- payments: org + tarih, file_id
CREATE INDEX IF NOT EXISTS payments_org_created_idx
  ON public.payments (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS payments_file_idx
  ON public.payments (file_id);

-- cash_transactions: organization + account
CREATE INDEX IF NOT EXISTS cash_transactions_org_created_idx
  ON public.cash_transactions (organization_id, created_at DESC);

CREATE INDEX IF NOT EXISTS cash_transactions_account_idx
  ON public.cash_transactions (account_id, created_at DESC);

-- visa_file_expenses: file
CREATE INDEX IF NOT EXISTS visa_file_expenses_file_idx
  ON public.visa_file_expenses (file_id);

-- randevu_talepleri: org + arsiv + tarih
CREATE INDEX IF NOT EXISTS randevu_talepleri_org_idx
  ON public.randevu_talepleri (organization_id, arsivlendi, created_at DESC);

-- notifications: user + okunmadi
CREATE INDEX IF NOT EXISTS notifications_user_unread_idx
  ON public.notifications (user_id, is_read, created_at DESC);

NOTIFY pgrst, 'reload schema';
