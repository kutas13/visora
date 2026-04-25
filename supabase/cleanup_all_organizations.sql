-- ============================================================
-- VISORA: Tum sirketleri (organizations) ve baglı tum verileri sil.
-- KORUNAN: platform_owner rolundeki kullanicilar (sen).
--
-- KULLANIM: Supabase Dashboard -> SQL Editor -> bu dosyayi yapistir
--           -> RUN. Tek transaction icinde calisir.
--
-- Bu script DAYANIKLI: 023 migration uygulanmasa da (organization_id
-- kolonu olmasa da) calisir; eksik kolon/tablo durumlarini gorur.
-- ============================================================

BEGIN;

DO $cleanup$
DECLARE
  v_orgs INT;
  v_users INT;
  v_visa INT;
  v_pay INT;
  v_owner INT;
  has_visa_org BOOLEAN;
  has_payments_org BOOLEAN;
  has_dailyrep_org BOOLEAN;
  has_actlog_org BOOLEAN;
  has_companies BOOLEAN;
BEGIN
  -- ---- 0) On bilgi ----
  SELECT COUNT(*) INTO v_orgs FROM public.organizations;
  SELECT COUNT(*) INTO v_users FROM public.profiles WHERE role <> 'platform_owner';
  RAISE NOTICE 'BASLANGIC: organizations=%, kullanici=% (platform_owner haric)', v_orgs, v_users;

  -- ---- Kolon/tablo varligi tespiti ----
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'visa_files' AND column_name = 'organization_id'
  ) INTO has_visa_org;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'payments' AND column_name = 'organization_id'
  ) INTO has_payments_org;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'daily_reports' AND column_name = 'organization_id'
  ) INTO has_dailyrep_org;

  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns
     WHERE table_schema = 'public' AND table_name = 'activity_logs' AND column_name = 'organization_id'
  ) INTO has_actlog_org;

  SELECT to_regclass('public.companies') IS NOT NULL INTO has_companies;

  RAISE NOTICE 'Kolonlar: visa_files.org=%, payments.org=%, daily_reports.org=%, activity_logs.org=%, companies.tablo=%',
               has_visa_org, has_payments_org, has_dailyrep_org, has_actlog_org, has_companies;

  -- ============================================================
  -- 1) Profile-bazli silme (kolon olsa da olmasa da calisir)
  --    Platform_owner'i koruyup tum digerlerinin verisini sileriz.
  -- ============================================================

  -- activity_logs: actor_id veya organization_id ile
  IF has_actlog_org THEN
    EXECUTE 'DELETE FROM public.activity_logs WHERE organization_id IS NOT NULL';
  END IF;
  DELETE FROM public.activity_logs
   WHERE actor_id IN (SELECT id FROM public.profiles WHERE role <> 'platform_owner');

  -- notifications
  DELETE FROM public.notifications
   WHERE user_id IN (SELECT id FROM public.profiles WHERE role <> 'platform_owner');

  -- payments
  IF has_payments_org THEN
    EXECUTE 'DELETE FROM public.payments WHERE organization_id IS NOT NULL';
  END IF;
  DELETE FROM public.payments
   WHERE file_id IN (
     SELECT id FROM public.visa_files
      WHERE assigned_user_id IN (SELECT id FROM public.profiles WHERE role <> 'platform_owner')
   );

  -- daily_reports
  IF has_dailyrep_org THEN
    EXECUTE 'DELETE FROM public.daily_reports WHERE organization_id IS NOT NULL';
  END IF;
  DELETE FROM public.daily_reports
   WHERE user_id IN (SELECT id FROM public.profiles WHERE role <> 'platform_owner');

  -- visa_files
  IF has_visa_org THEN
    EXECUTE 'DELETE FROM public.visa_files WHERE organization_id IS NOT NULL';
  END IF;
  DELETE FROM public.visa_files
   WHERE assigned_user_id IN (SELECT id FROM public.profiles WHERE role <> 'platform_owner');

  -- companies (cari) — tablo varsa
  IF has_companies THEN
    EXECUTE 'DELETE FROM public.companies';
  END IF;

  -- platform abonelik / odeme (organizations CASCADE da yapar ama explicit)
  IF to_regclass('public.platform_payments') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.platform_payments';
  END IF;
  IF to_regclass('public.platform_subscriptions') IS NOT NULL THEN
    EXECUTE 'DELETE FROM public.platform_subscriptions';
  END IF;

  -- ============================================================
  -- 2) Profilleri ve auth.users'i sil (platform_owner haric)
  -- ============================================================
  WITH gone AS (
    DELETE FROM public.profiles
     WHERE role <> 'platform_owner'
     RETURNING id
  )
  DELETE FROM auth.users WHERE id IN (SELECT id FROM gone);

  -- ============================================================
  -- 3) Organizations'i sil
  -- ============================================================
  DELETE FROM public.organizations;

  -- ============================================================
  -- 4) Dogrulama
  -- ============================================================
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
END
$cleanup$;

COMMIT;

NOTIFY pgrst, 'reload schema';
