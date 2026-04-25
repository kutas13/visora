-- ============================================================
-- VISORA: Tum sirketleri (organizations) ve baglı tum verileri sil.
-- KORUNAN: platform_owner rolundeki kullanicilar (sen).
--
-- KULLANIM: Supabase Dashboard -> SQL Editor -> bu dosyayi yapistir
--           -> RUN. Tek transaction icinde calisir, hata olursa
--           hicbir sey silinmez.
--
-- DIKKAT: Geri alinamaz! Calistirmadan once Supabase backup alin.
-- ============================================================

BEGIN;

-- 0) Bilgi: silinecek profil sayisi (platform_owner haric)
DO $$
DECLARE
  v_orgs INT;
  v_users INT;
BEGIN
  SELECT COUNT(*) INTO v_orgs FROM public.organizations;
  SELECT COUNT(*) INTO v_users
    FROM public.profiles
   WHERE role <> 'platform_owner';
  RAISE NOTICE 'Silinecek organizations: %, kullanici (platform_owner haric): %', v_orgs, v_users;
END $$;

-- ------------------------------------------------------------
-- 1) Org'a bagli verileri sil (FK CASCADE'ler bircogunu otomatik
--    halleder ama yine de garanti olsun diye explicit siliyoruz)
-- ------------------------------------------------------------

-- Visa dosyalari (visa_files'a bagli payments, activity_logs vb.
-- CASCADE ile gider; yoksa asagida tek tek temizlenecek)
DELETE FROM public.activity_logs
 WHERE actor_id IN (SELECT id FROM public.profiles WHERE role <> 'platform_owner')
    OR organization_id IS NOT NULL;

DELETE FROM public.notifications
 WHERE user_id IN (SELECT id FROM public.profiles WHERE role <> 'platform_owner');

DELETE FROM public.payments
 WHERE file_id IN (SELECT id FROM public.visa_files);

DELETE FROM public.daily_reports
 WHERE user_id IN (SELECT id FROM public.profiles WHERE role <> 'platform_owner')
    OR organization_id IS NOT NULL;

DELETE FROM public.visa_files
 WHERE assigned_user_id IN (SELECT id FROM public.profiles WHERE role <> 'platform_owner')
    OR organization_id IS NOT NULL;

-- Cari firmalar
DELETE FROM public.companies WHERE TRUE;

-- Platform abonelik & odeme kayitlari (organizations CASCADE'i de halleder
-- ama explicit silelim)
DELETE FROM public.platform_payments WHERE TRUE;
DELETE FROM public.platform_subscriptions WHERE TRUE;

-- ------------------------------------------------------------
-- 2) Profilleri sil (platform_owner'i koru)
-- ------------------------------------------------------------
WITH gone AS (
  DELETE FROM public.profiles
   WHERE role <> 'platform_owner'
   RETURNING id
)
-- Auth.users'tan da ayni kullanicilari sil (Supabase auth)
DELETE FROM auth.users WHERE id IN (SELECT id FROM gone);

-- ------------------------------------------------------------
-- 3) Organizations'i sil
-- ------------------------------------------------------------
DELETE FROM public.organizations WHERE TRUE;

-- ------------------------------------------------------------
-- 4) Kalan veriyi dogrula
-- ------------------------------------------------------------
DO $$
DECLARE
  v_orgs INT;
  v_users INT;
  v_visa INT;
  v_pay INT;
  v_owner INT;
BEGIN
  SELECT COUNT(*) INTO v_orgs FROM public.organizations;
  SELECT COUNT(*) INTO v_users FROM public.profiles WHERE role <> 'platform_owner';
  SELECT COUNT(*) INTO v_visa FROM public.visa_files;
  SELECT COUNT(*) INTO v_pay FROM public.payments;
  SELECT COUNT(*) INTO v_owner FROM public.profiles WHERE role = 'platform_owner';

  RAISE NOTICE '--- TEMIZLIK SONRASI ---';
  RAISE NOTICE 'organizations  : %', v_orgs;
  RAISE NOTICE 'kullanicilar   : % (platform_owner haric)', v_users;
  RAISE NOTICE 'visa_files     : %', v_visa;
  RAISE NOTICE 'payments       : %', v_pay;
  RAISE NOTICE 'platform_owner : % (KORUNDU)', v_owner;
END $$;

COMMIT;

-- Schema cache'i yenile (PostgREST)
NOTIFY pgrst, 'reload schema';
