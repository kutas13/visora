-- ============================================================
-- 031_org_fk_cascade.sql
-- organizations silinince tum bagli satirlari CASCADE ile kaldir.
-- SET NULL veya eksik ON DELETE ACTION olan FK'leri CASCADE'e cevirir.
-- ============================================================

-- ============================================================
-- 1. randevu_talepleri.organization_id
--    021 migration'da CASCADE olmadan eklenmis olabilir.
-- ============================================================
DO $$
BEGIN
  -- Var olan FK'yi kaldir, CASCADE ile yeniden olustur
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'randevu_talepleri_organization_id_fkey'
      AND table_name = 'randevu_talepleri'
  ) THEN
    ALTER TABLE public.randevu_talepleri
      DROP CONSTRAINT randevu_talepleri_organization_id_fkey;
  END IF;

  -- organization_id kolonu varsa CASCADE ekle
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'randevu_talepleri'
      AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.randevu_talepleri
      ADD CONSTRAINT randevu_talepleri_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 2. activity_logs.organization_id  (SET NULL → CASCADE)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name LIKE '%activity_logs%organization_id%'
      AND table_name = 'activity_logs'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE public.activity_logs DROP CONSTRAINT ' || constraint_name
      FROM information_schema.table_constraints
      WHERE constraint_name LIKE '%activity_logs%organization_id%'
        AND table_name = 'activity_logs'
      LIMIT 1
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'activity_logs' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.activity_logs
      ADD CONSTRAINT activity_logs_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 3. notifications.organization_id  (SET NULL → CASCADE)
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name LIKE '%notifications%organization_id%'
      AND table_name = 'notifications'
  ) THEN
    EXECUTE (
      SELECT 'ALTER TABLE public.notifications DROP CONSTRAINT ' || constraint_name
      FROM information_schema.table_constraints
      WHERE constraint_name LIKE '%notifications%organization_id%'
        AND table_name = 'notifications'
      LIMIT 1
    );
  END IF;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'notifications' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.notifications
      ADD CONSTRAINT notifications_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 4. visa_files.organization_id  (SET NULL → CASCADE)
-- ============================================================
DO $$
BEGIN
  -- Var olan constraintlerin hepsini kaldir (isim cesitlilik gosterebilir)
  PERFORM constraint_name FROM information_schema.table_constraints
  WHERE table_name = 'visa_files' AND constraint_name LIKE '%organization_id%';

  FOR r IN
    SELECT constraint_name FROM information_schema.table_constraints
    WHERE table_name = 'visa_files' AND constraint_name LIKE '%organization_id%'
  LOOP
    EXECUTE 'ALTER TABLE public.visa_files DROP CONSTRAINT IF EXISTS ' || r.constraint_name;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'visa_files' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.visa_files
      ADD CONSTRAINT visa_files_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 5. visa_groups.organization_id  (eksik action → CASCADE)
-- ============================================================
DO $$
BEGIN
  FOR r IN
    SELECT constraint_name FROM information_schema.table_constraints
    WHERE table_name = 'visa_groups' AND constraint_name LIKE '%organization_id%'
  LOOP
    EXECUTE 'ALTER TABLE public.visa_groups DROP CONSTRAINT IF EXISTS ' || r.constraint_name;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'visa_groups' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.visa_groups
      ADD CONSTRAINT visa_groups_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 6. companies.organization_id  (eksik action → CASCADE)
-- ============================================================
DO $$
BEGIN
  FOR r IN
    SELECT constraint_name FROM information_schema.table_constraints
    WHERE table_name = 'companies' AND constraint_name LIKE '%organization_id%'
  LOOP
    EXECUTE 'ALTER TABLE public.companies DROP CONSTRAINT IF EXISTS ' || r.constraint_name;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'companies' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.companies
      ADD CONSTRAINT companies_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 7. gunluk_raporlar.organization_id  (SET NULL → CASCADE)
-- ============================================================
DO $$
BEGIN
  FOR r IN
    SELECT constraint_name FROM information_schema.table_constraints
    WHERE table_name = 'gunluk_raporlar' AND constraint_name LIKE '%organization_id%'
  LOOP
    EXECUTE 'ALTER TABLE public.gunluk_raporlar DROP CONSTRAINT IF EXISTS ' || r.constraint_name;
  END LOOP;

  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'gunluk_raporlar' AND column_name = 'organization_id'
  ) THEN
    ALTER TABLE public.gunluk_raporlar
      ADD CONSTRAINT gunluk_raporlar_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE;
  END IF;
END $$;

-- ============================================================
-- 8. cari_hesap (veya cari_hesaplar) tablosu  (SET NULL → CASCADE)
-- ============================================================
DO $$
DECLARE
  tbl TEXT;
BEGIN
  FOREACH tbl IN ARRAY ARRAY['cari_hesap','cari_hesaplar','cari'] LOOP
    IF EXISTS (
      SELECT 1 FROM information_schema.columns
      WHERE table_name = tbl AND column_name = 'organization_id'
    ) THEN
      FOR r IN
        SELECT constraint_name FROM information_schema.table_constraints
        WHERE table_name = tbl AND constraint_name LIKE '%organization_id%'
      LOOP
        EXECUTE 'ALTER TABLE public.' || tbl || ' DROP CONSTRAINT IF EXISTS ' || r.constraint_name;
      END LOOP;
      EXECUTE 'ALTER TABLE public.' || tbl ||
        ' ADD CONSTRAINT ' || tbl || '_organization_id_fkey
          FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE CASCADE';
    END IF;
  END LOOP;
END $$;

NOTIFY pgrst, 'reload schema';
