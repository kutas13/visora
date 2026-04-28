-- ============================================================
-- 026 — Giriş / Çıkış (Auth) Audit Logları
--   - activity_logs üzerinde 'login' ve 'logout' tiplerinin
--     platform_owner tarafından TAM görünebilirliği
--   - Genel müdür ve personel zaten kendi şirketlerinin loglarını
--     mevcut policy'lerle görüyor.
--   - Kullanıcılar kendi 'login'/'logout' satırlarını insert
--     edebilir (mevcut "Users can insert own logs" policy yeterli).
-- Idempotent.
-- ============================================================

-- Platform owner: TÜM activity_logs satırlarını okuyabilsin
DROP POLICY IF EXISTS "activity_logs_platform_owner_read" ON public.activity_logs;
CREATE POLICY "activity_logs_platform_owner_read" ON public.activity_logs
  FOR SELECT TO authenticated
  USING (public.is_platform_owner());

-- Hızlı sorgu için index
CREATE INDEX IF NOT EXISTS activity_logs_type_created_idx
  ON public.activity_logs (type, created_at DESC);

NOTIFY pgrst, 'reload schema';
