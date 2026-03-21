-- ===========================================
-- FIX MISSING TABLES AND COLUMNS
-- Supabase SQL Editor'da çalıştırın
-- ===========================================

-- 1. notifications tablosuna is_read kolonu ekle (yoksa)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'notifications' AND column_name = 'is_read'
  ) THEN
    ALTER TABLE public.notifications ADD COLUMN is_read BOOLEAN DEFAULT false;
  END IF;
END $$;

-- 2. internal_messages tablosu oluştur (yoksa)
CREATE TABLE IF NOT EXISTS public.internal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Internal Messages için RLS (yoksa)
ALTER TABLE public.internal_messages ENABLE ROW LEVEL SECURITY;

-- Önce mevcut policy'leri kaldır (hata vermemesi için)
DROP POLICY IF EXISTS "Users can view own messages" ON public.internal_messages;
DROP POLICY IF EXISTS "Users can send messages" ON public.internal_messages;
DROP POLICY IF EXISTS "Users can update received messages" ON public.internal_messages;

-- Policy'leri oluştur
CREATE POLICY "Users can view own messages" ON public.internal_messages
  FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid());

CREATE POLICY "Users can send messages" ON public.internal_messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());

CREATE POLICY "Users can update received messages" ON public.internal_messages
  FOR UPDATE USING (receiver_id = auth.uid());

-- 4. Index'leri oluştur (yoksa)
CREATE INDEX IF NOT EXISTS internal_messages_sender_idx ON public.internal_messages(sender_id);
CREATE INDEX IF NOT EXISTS internal_messages_receiver_idx ON public.internal_messages(receiver_id);
CREATE INDEX IF NOT EXISTS notifications_is_read_idx ON public.notifications(is_read);

-- 5. visa_groups ve visa_group_members tabloları (yoksa)
CREATE TABLE IF NOT EXISTS public.visa_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  grup_adi TEXT NOT NULL,
  aciklama TEXT,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.visa_group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES public.visa_groups(id) ON DELETE CASCADE,
  visa_file_id UUID REFERENCES public.visa_files(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, visa_file_id)
);

-- Groups RLS
ALTER TABLE public.visa_groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.visa_group_members ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "visa_groups_select" ON public.visa_groups;
DROP POLICY IF EXISTS "visa_groups_insert" ON public.visa_groups;
DROP POLICY IF EXISTS "visa_groups_update" ON public.visa_groups;
DROP POLICY IF EXISTS "visa_groups_delete" ON public.visa_groups;
DROP POLICY IF EXISTS "visa_group_members_select" ON public.visa_group_members;
DROP POLICY IF EXISTS "visa_group_members_insert" ON public.visa_group_members;
DROP POLICY IF EXISTS "visa_group_members_delete" ON public.visa_group_members;

CREATE POLICY "visa_groups_select" ON public.visa_groups FOR SELECT TO authenticated USING (true);
CREATE POLICY "visa_groups_insert" ON public.visa_groups FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "visa_groups_update" ON public.visa_groups FOR UPDATE TO authenticated USING (true);
CREATE POLICY "visa_groups_delete" ON public.visa_groups FOR DELETE TO authenticated USING (true);

CREATE POLICY "visa_group_members_select" ON public.visa_group_members FOR SELECT TO authenticated USING (true);
CREATE POLICY "visa_group_members_insert" ON public.visa_group_members FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "visa_group_members_delete" ON public.visa_group_members FOR DELETE TO authenticated USING (true);

SELECT 'Tüm düzeltmeler başarıyla uygulandı!' as sonuc;
