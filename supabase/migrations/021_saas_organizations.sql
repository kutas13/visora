-- Visora SaaS: firma (organization) bazlı çok kiracılı yapı
-- 1 genel müdür (admin) + en fazla 3 personel (staff) / firma
-- Kurulum yalnızca VISORA_PLATFORM_SETUP_SECRET ile API üzerinden (service role)

-- ============================================
-- 1) ORGANIZATIONS
-- ============================================
CREATE TABLE IF NOT EXISTS public.organizations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS organizations_created_at_idx ON public.organizations (created_at DESC);

ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "organizations_select_member" ON public.organizations;
CREATE POLICY "organizations_select_member" ON public.organizations
  FOR SELECT USING (
    id IN (SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND organization_id IS NOT NULL)
  );

-- ============================================
-- 2) PROFILES: organization_id + rol genişletme
-- ============================================
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE SET NULL;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
  CHECK (role IN ('admin', 'staff', 'muhasebe'));

CREATE UNIQUE INDEX IF NOT EXISTS idx_one_admin_per_organization
  ON public.profiles (organization_id)
  WHERE role = 'admin' AND organization_id IS NOT NULL;

-- ============================================
-- 3) Personel limiti (en fazla 3 staff / firma)
-- ============================================
CREATE OR REPLACE FUNCTION public.enforce_organization_staff_limit()
RETURNS TRIGGER AS $$
DECLARE
  staff_count INTEGER;
BEGIN
  IF NEW.organization_id IS NULL OR NEW.role <> 'staff' THEN
    RETURN NEW;
  END IF;

  SELECT COUNT(*)::INTEGER INTO staff_count
  FROM public.profiles p
  WHERE p.organization_id = NEW.organization_id
    AND p.role = 'staff'
    AND p.id IS DISTINCT FROM NEW.id;

  IF staff_count >= 3 THEN
    RAISE EXCEPTION 'VISORA_STAFF_LIMIT: Bu firmada en fazla 3 personel (staff) hesabı açılabilir.';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS enforce_organization_staff_limit ON public.profiles;
CREATE TRIGGER enforce_organization_staff_limit
  BEFORE INSERT OR UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.enforce_organization_staff_limit();

-- ============================================
-- 4) Auth: yeni kullanıcı profili (metadata ile org)
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  org UUID;
BEGIN
  org := NULLIF(TRIM(NEW.raw_user_meta_data->>'organization_id'), '')::uuid;

  INSERT INTO public.profiles (id, name, role, organization_id)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'staff'),
    org
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- ============================================
-- 5) commission_rates: firma bazlı
-- ============================================
ALTER TABLE public.commission_rates
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id) ON DELETE CASCADE;

DELETE FROM public.commission_rates;

ALTER TABLE public.commission_rates DROP CONSTRAINT IF EXISTS commission_rates_country_key;

ALTER TABLE public.commission_rates ALTER COLUMN organization_id SET NOT NULL;

CREATE UNIQUE INDEX IF NOT EXISTS commission_rates_org_country_uidx
  ON public.commission_rates (organization_id, country);

DROP POLICY IF EXISTS "commission_rates_read" ON public.commission_rates;
DROP POLICY IF EXISTS "commission_rates_write" ON public.commission_rates;

CREATE POLICY "commission_rates_select_org" ON public.commission_rates
  FOR SELECT TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND organization_id IS NOT NULL
    )
  );

CREATE POLICY "commission_rates_mutate_org" ON public.commission_rates
  FOR ALL TO authenticated
  USING (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND organization_id IS NOT NULL
    )
  )
  WITH CHECK (
    organization_id IN (
      SELECT organization_id FROM public.profiles WHERE id = auth.uid() AND organization_id IS NOT NULL
    )
  );

-- ============================================
-- 6) PROFILES RLS (SECURITY DEFINER: RLS iç içe sorgu döngüsünü önler)
-- ============================================
CREATE OR REPLACE FUNCTION public.auth_user_organization_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT organization_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;

REVOKE ALL ON FUNCTION public.auth_user_organization_id() FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.auth_user_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.auth_user_organization_id() TO service_role;

DROP POLICY IF EXISTS "Users can view own profile" ON public.profiles;
DROP POLICY IF EXISTS "Admins can view all profiles" ON public.profiles;

CREATE POLICY "profiles_select_org" ON public.profiles
  FOR SELECT USING (
    auth.uid() IS NOT NULL
    AND (
      id = auth.uid()
      OR (
        organization_id IS NOT NULL
        AND organization_id = public.auth_user_organization_id()
      )
    )
  );

-- ============================================
-- 7) VISA_FILES RLS (firma içi)
-- ============================================
DROP POLICY IF EXISTS "Staff can view own files" ON public.visa_files;
DROP POLICY IF EXISTS "Admins can view all files" ON public.visa_files;
DROP POLICY IF EXISTS "Staff can insert own files" ON public.visa_files;
DROP POLICY IF EXISTS "Admins can insert any file" ON public.visa_files;
DROP POLICY IF EXISTS "Staff can update own files" ON public.visa_files;
DROP POLICY IF EXISTS "Admins can update all files" ON public.visa_files;
DROP POLICY IF EXISTS "Staff can view cari files" ON public.visa_files;
DROP POLICY IF EXISTS "Staff can update cari files" ON public.visa_files;

CREATE POLICY "visa_files_select_staff_own" ON public.visa_files
  FOR SELECT USING (assigned_user_id = auth.uid());

CREATE POLICY "visa_files_select_staff_cari" ON public.visa_files
  FOR SELECT USING (
    cari_sahibi IS NOT NULL
    AND UPPER(cari_sahibi) = UPPER((SELECT name FROM public.profiles WHERE id = auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.profiles owner_p
      WHERE owner_p.id = visa_files.assigned_user_id
        AND owner_p.organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "visa_files_select_admin_org" ON public.visa_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles me
      JOIN public.profiles assign ON assign.id = visa_files.assigned_user_id
      WHERE me.id = auth.uid()
        AND me.role = 'admin'
        AND me.organization_id IS NOT NULL
        AND me.organization_id = assign.organization_id
    )
  );

CREATE POLICY "visa_files_insert_staff" ON public.visa_files
  FOR INSERT WITH CHECK (
    assigned_user_id = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND organization_id IS NOT NULL)
  );

CREATE POLICY "visa_files_insert_admin_org" ON public.visa_files
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles me
      JOIN public.profiles assign ON assign.id = visa_files.assigned_user_id
      WHERE me.id = auth.uid()
        AND me.role = 'admin'
        AND me.organization_id IS NOT NULL
        AND me.organization_id = assign.organization_id
    )
  );

CREATE POLICY "visa_files_update_staff_own" ON public.visa_files
  FOR UPDATE USING (assigned_user_id = auth.uid());

CREATE POLICY "visa_files_update_staff_cari" ON public.visa_files
  FOR UPDATE USING (
    cari_sahibi IS NOT NULL
    AND UPPER(cari_sahibi) = UPPER((SELECT name FROM public.profiles WHERE id = auth.uid()))
    AND EXISTS (
      SELECT 1 FROM public.profiles owner_p
      WHERE owner_p.id = visa_files.assigned_user_id
        AND owner_p.organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
    )
  );

CREATE POLICY "visa_files_update_admin_org" ON public.visa_files
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles me
      JOIN public.profiles assign ON assign.id = visa_files.assigned_user_id
      WHERE me.id = auth.uid()
        AND me.role = 'admin'
        AND me.organization_id IS NOT NULL
        AND me.organization_id = assign.organization_id
    )
  );

-- ============================================
-- 8) PAYMENTS RLS
-- ============================================
DROP POLICY IF EXISTS "Staff can view payments of own files" ON public.payments;
DROP POLICY IF EXISTS "Admins can view all payments" ON public.payments;
DROP POLICY IF EXISTS "Staff can insert payments for own files" ON public.payments;
DROP POLICY IF EXISTS "Admins can insert any payment" ON public.payments;

CREATE POLICY "payments_select_staff" ON public.payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.visa_files vf
      WHERE vf.id = payments.file_id
        AND vf.assigned_user_id = auth.uid()
    )
  );

CREATE POLICY "payments_select_admin_org" ON public.payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles me
      JOIN public.visa_files vf ON vf.assigned_user_id IN (
        SELECT id FROM public.profiles WHERE organization_id = me.organization_id
      )
      WHERE me.id = auth.uid()
        AND me.role = 'admin'
        AND vf.id = payments.file_id
    )
  );

CREATE POLICY "payments_insert_staff" ON public.payments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.visa_files vf
      WHERE vf.id = file_id AND vf.assigned_user_id = auth.uid()
    )
  );

CREATE POLICY "payments_insert_admin_org" ON public.payments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles me
      JOIN public.visa_files vf ON vf.id = file_id
      JOIN public.profiles assign ON assign.id = vf.assigned_user_id
      WHERE me.id = auth.uid()
        AND me.role = 'admin'
        AND me.organization_id = assign.organization_id
    )
  );

-- ============================================
-- 9) ACTIVITY_LOGS RLS
-- ============================================
DROP POLICY IF EXISTS "Staff can view own logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Admins can view all logs" ON public.activity_logs;
DROP POLICY IF EXISTS "Users can insert own logs" ON public.activity_logs;

CREATE POLICY "activity_logs_select_staff" ON public.activity_logs
  FOR SELECT USING (
    actor_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.visa_files vf
      WHERE vf.id = activity_logs.file_id AND vf.assigned_user_id = auth.uid()
    )
  );

CREATE POLICY "activity_logs_select_admin_org" ON public.activity_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles me
      WHERE me.id = auth.uid()
        AND me.role = 'admin'
        AND me.organization_id IS NOT NULL
        AND (
          activity_logs.file_id IS NULL
          OR EXISTS (
            SELECT 1 FROM public.visa_files vf
            JOIN public.profiles assign ON assign.id = vf.assigned_user_id
            WHERE vf.id = activity_logs.file_id
              AND assign.organization_id = me.organization_id
          )
        )
    )
  );

CREATE POLICY "activity_logs_insert" ON public.activity_logs
  FOR INSERT WITH CHECK (
    actor_id = auth.uid()
    AND (
      file_id IS NULL
      OR EXISTS (
        SELECT 1 FROM public.visa_files vf
        JOIN public.profiles assign ON assign.id = vf.assigned_user_id
        WHERE vf.id = file_id
          AND assign.organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
      )
    )
  );

-- ============================================
-- 10) NOTIFICATIONS RLS
-- ============================================
DROP POLICY IF EXISTS "Users can view own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can view all notifications" ON public.notifications;
DROP POLICY IF EXISTS "Users can update own notifications" ON public.notifications;
DROP POLICY IF EXISTS "Admins can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Staff can insert notifications" ON public.notifications;

CREATE POLICY "notifications_select" ON public.notifications
  FOR SELECT USING (
    user_id = auth.uid()
    OR EXISTS (
      SELECT 1 FROM public.profiles me
      JOIN public.profiles target ON target.id = notifications.user_id
      WHERE me.id = auth.uid()
        AND me.role = 'admin'
        AND me.organization_id IS NOT NULL
        AND me.organization_id = target.organization_id
    )
  );

CREATE POLICY "notifications_update_own" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

CREATE POLICY "notifications_insert" ON public.notifications
  FOR INSERT WITH CHECK (
    auth.uid() IS NOT NULL
    AND EXISTS (
      SELECT 1 FROM public.profiles me
      JOIN public.profiles target ON target.id = user_id
      WHERE me.id = auth.uid()
        AND me.organization_id IS NOT NULL
        AND me.organization_id = target.organization_id
    )
  );

-- ============================================
-- 11) INTERNAL_MESSAGES RLS
-- ============================================
DROP POLICY IF EXISTS "Users can view own messages" ON public.internal_messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.internal_messages;
DROP POLICY IF EXISTS "Users can update received messages" ON public.internal_messages;

CREATE POLICY "internal_messages_select" ON public.internal_messages
  FOR SELECT USING (
    (sender_id = auth.uid() OR receiver_id = auth.uid())
    AND (SELECT organization_id FROM public.profiles WHERE id = sender_id)
        = (SELECT organization_id FROM public.profiles WHERE id = receiver_id)
  );

CREATE POLICY "internal_messages_insert" ON public.internal_messages
  FOR INSERT WITH CHECK (
    sender_id = auth.uid()
    AND (SELECT organization_id FROM public.profiles WHERE id = sender_id)
        = (SELECT organization_id FROM public.profiles WHERE id = receiver_id)
  );

CREATE POLICY "internal_messages_update" ON public.internal_messages
  FOR UPDATE USING (receiver_id = auth.uid());

-- ============================================
-- 12) DAILY_REPORTS RLS
-- ============================================
DROP POLICY IF EXISTS "Admins can view all reports" ON public.daily_reports;

CREATE POLICY "daily_reports_select_admin_org" ON public.daily_reports
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles me
      JOIN public.profiles owner ON owner.id = daily_reports.user_id
      WHERE me.id = auth.uid()
        AND me.role = 'admin'
        AND me.organization_id IS NOT NULL
        AND me.organization_id = owner.organization_id
    )
  );

-- ============================================
-- 13) RANDEVU_TALEPLERI
-- ============================================
ALTER TABLE public.randevu_talepleri
  ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);

UPDATE public.randevu_talepleri rt
SET organization_id = p.organization_id
FROM public.profiles p
WHERE rt.created_by = p.id AND rt.organization_id IS NULL;

CREATE OR REPLACE FUNCTION public.set_randevu_organization_from_creator()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.organization_id IS NULL AND NEW.created_by IS NOT NULL THEN
    SELECT organization_id INTO NEW.organization_id FROM public.profiles WHERE id = NEW.created_by;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_randevu_set_org ON public.randevu_talepleri;
CREATE TRIGGER trg_randevu_set_org
  BEFORE INSERT OR UPDATE ON public.randevu_talepleri
  FOR EACH ROW
  EXECUTE FUNCTION public.set_randevu_organization_from_creator();

DROP POLICY IF EXISTS "randevu_talepleri_select" ON public.randevu_talepleri;
DROP POLICY IF EXISTS "randevu_talepleri_insert" ON public.randevu_talepleri;
DROP POLICY IF EXISTS "randevu_talepleri_update" ON public.randevu_talepleri;
DROP POLICY IF EXISTS "randevu_talepleri_delete" ON public.randevu_talepleri;

CREATE POLICY "randevu_talepleri_select_org" ON public.randevu_talepleri
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles creator
      JOIN public.profiles me ON me.organization_id = creator.organization_id
      WHERE creator.id = randevu_talepleri.created_by
        AND me.id = auth.uid()
        AND creator.organization_id IS NOT NULL
    )
  );

CREATE POLICY "randevu_talepleri_insert_org" ON public.randevu_talepleri
  FOR INSERT WITH CHECK (
    created_by = auth.uid()
    AND EXISTS (SELECT 1 FROM public.profiles WHERE id = auth.uid() AND organization_id IS NOT NULL)
  );

CREATE POLICY "randevu_talepleri_update_org" ON public.randevu_talepleri
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles creator
      JOIN public.profiles me ON me.organization_id = creator.organization_id
      WHERE creator.id = randevu_talepleri.created_by AND me.id = auth.uid()
    )
  );

CREATE POLICY "randevu_talepleri_delete_org" ON public.randevu_talepleri
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles creator
      JOIN public.profiles me ON me.organization_id = creator.organization_id
      WHERE creator.id = randevu_talepleri.created_by AND me.id = auth.uid()
    )
  );

-- ============================================
-- 14) VIZE_GORSELLERI_UPLOADS (016 migration gerekir)
-- ============================================
DROP POLICY IF EXISTS "staff_select_own" ON public.vize_gorselleri_uploads;
DROP POLICY IF EXISTS "staff_insert_own" ON public.vize_gorselleri_uploads;
DROP POLICY IF EXISTS "staff_update_own" ON public.vize_gorselleri_uploads;
DROP POLICY IF EXISTS "staff_delete_own" ON public.vize_gorselleri_uploads;
DROP POLICY IF EXISTS "admin_select_all" ON public.vize_gorselleri_uploads;
DROP POLICY IF EXISTS "admin_delete_all" ON public.vize_gorselleri_uploads;
DROP POLICY IF EXISTS "admin_update_all" ON public.vize_gorselleri_uploads;

CREATE POLICY "vize_gors_staff_own" ON public.vize_gorselleri_uploads
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "vize_gors_staff_insert" ON public.vize_gorselleri_uploads
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "vize_gors_staff_update" ON public.vize_gorselleri_uploads
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "vize_gors_staff_delete" ON public.vize_gorselleri_uploads
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "vize_gors_admin_select_org" ON public.vize_gorselleri_uploads
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles me
      JOIN public.profiles u ON u.id = vize_gorselleri_uploads.user_id
      WHERE me.id = auth.uid()
        AND me.role = 'admin'
        AND me.organization_id = u.organization_id
    )
  );

CREATE POLICY "vize_gors_admin_update_org" ON public.vize_gorselleri_uploads
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles me
      JOIN public.profiles u ON u.id = vize_gorselleri_uploads.user_id
      WHERE me.id = auth.uid()
        AND me.role = 'admin'
        AND me.organization_id = u.organization_id
    )
  );

CREATE POLICY "vize_gors_admin_delete_org" ON public.vize_gorselleri_uploads
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles me
      JOIN public.profiles u ON u.id = vize_gorselleri_uploads.user_id
      WHERE me.id = auth.uid()
        AND me.role = 'admin'
        AND me.organization_id = u.organization_id
    )
  );

-- ============================================
-- 15) VISA_GROUPS (varsa)
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'visa_groups'
  ) THEN
    ALTER TABLE public.visa_groups ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
    UPDATE public.visa_groups vg
    SET organization_id = p.organization_id
    FROM public.profiles p
    WHERE vg.created_by = p.id AND vg.organization_id IS NULL;

    CREATE OR REPLACE FUNCTION public.set_visa_group_organization_from_creator()
    RETURNS TRIGGER AS $vgfn$
    BEGIN
      IF NEW.organization_id IS NULL AND NEW.created_by IS NOT NULL THEN
        SELECT organization_id INTO NEW.organization_id FROM public.profiles WHERE id = NEW.created_by;
      END IF;
      RETURN NEW;
    END;
    $vgfn$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

    DROP TRIGGER IF EXISTS trg_visa_groups_set_org ON public.visa_groups;
    CREATE TRIGGER trg_visa_groups_set_org
      BEFORE INSERT OR UPDATE ON public.visa_groups
      FOR EACH ROW
      EXECUTE FUNCTION public.set_visa_group_organization_from_creator();

    DROP POLICY IF EXISTS "visa_groups_select" ON public.visa_groups;
    DROP POLICY IF EXISTS "visa_groups_insert" ON public.visa_groups;
    DROP POLICY IF EXISTS "visa_groups_update" ON public.visa_groups;
    DROP POLICY IF EXISTS "visa_groups_delete" ON public.visa_groups;

    CREATE POLICY "visa_groups_select_org" ON public.visa_groups
      FOR SELECT TO authenticated USING (
        organization_id IS NOT NULL
        AND organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
      );

    CREATE POLICY "visa_groups_insert_org" ON public.visa_groups
      FOR INSERT TO authenticated WITH CHECK (
        organization_id IS NOT NULL
        AND organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
      );

    CREATE POLICY "visa_groups_update_org" ON public.visa_groups
      FOR UPDATE TO authenticated USING (
        organization_id IS NOT NULL
        AND organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
      );

    CREATE POLICY "visa_groups_delete_org" ON public.visa_groups
      FOR DELETE TO authenticated USING (
        organization_id IS NOT NULL
        AND organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
      );
  END IF;
END $$;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'visa_group_members'
  ) THEN
    DROP POLICY IF EXISTS "visa_group_members_select" ON public.visa_group_members;
    DROP POLICY IF EXISTS "visa_group_members_insert" ON public.visa_group_members;
    DROP POLICY IF EXISTS "visa_group_members_delete" ON public.visa_group_members;

    CREATE POLICY "visa_group_members_select_org" ON public.visa_group_members
      FOR SELECT TO authenticated USING (
        EXISTS (
          SELECT 1 FROM public.visa_groups g
          WHERE g.id = visa_group_members.group_id
            AND g.organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        )
      );

    CREATE POLICY "visa_group_members_insert_org" ON public.visa_group_members
      FOR INSERT TO authenticated WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.visa_groups g
          WHERE g.id = visa_group_members.group_id
            AND g.organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        )
      );

    CREATE POLICY "visa_group_members_delete_org" ON public.visa_group_members
      FOR DELETE TO authenticated USING (
        EXISTS (
          SELECT 1 FROM public.visa_groups g
          WHERE g.id = visa_group_members.group_id
            AND g.organization_id = (SELECT organization_id FROM public.profiles WHERE id = auth.uid())
        )
      );
  END IF;
END $$;

-- ============================================
-- 16) companies tablosu (cari firmalar) — tenant sütunu
-- ============================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'companies'
  ) THEN
    ALTER TABLE public.companies ADD COLUMN IF NOT EXISTS organization_id UUID REFERENCES public.organizations(id);
  END IF;
END $$;

NOTIFY pgrst, 'reload schema';
