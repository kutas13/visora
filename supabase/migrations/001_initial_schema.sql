-- Visora — Vize Yönetim Sistemi - Veritabanı Şeması (ilk surum)
-- Bu dosyayı Supabase SQL Editor'da çalıştırın

-- ============================================
-- 1. PROFILES TABLOSU
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('admin', 'staff')),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Profiles için RLS
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

-- Herkes kendi profilini görebilir
CREATE POLICY "Users can view own profile" ON public.profiles
  FOR SELECT USING (auth.uid() = id);

-- Admin tüm profilleri görebilir
CREATE POLICY "Admins can view all profiles" ON public.profiles
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 2. VISA_FILES TABLOSU (ANA TABLO)
-- ============================================
CREATE TABLE IF NOT EXISTS public.visa_files (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  
  -- Müşteri bilgileri
  musteri_ad TEXT NOT NULL,
  pasaport_no TEXT NOT NULL,
  
  -- Hedef ülke
  hedef_ulke TEXT NOT NULL,
  ulke_manuel_mi BOOLEAN DEFAULT FALSE,
  
  -- İşlem tipi ve randevu
  islem_tipi TEXT NOT NULL CHECK (islem_tipi IN ('randevulu', 'randevusuz')),
  randevu_tarihi TIMESTAMPTZ NULL,
  
  -- Evrak durumu
  evrak_durumu TEXT NOT NULL DEFAULT 'gelmedi' CHECK (evrak_durumu IN ('gelmedi', 'geldi')),
  evrak_eksik_mi BOOLEAN NULL,
  evrak_not TEXT NULL,
  eksik_kayit_tarihi TIMESTAMPTZ NULL,
  
  -- Dosya durumu aşamaları
  dosya_hazir BOOLEAN DEFAULT FALSE,
  dosya_hazir_at TIMESTAMPTZ NULL,
  
  basvuru_yapildi BOOLEAN DEFAULT FALSE,
  basvuru_yapildi_at TIMESTAMPTZ NULL,
  
  islemden_cikti BOOLEAN DEFAULT FALSE,
  islemden_cikti_at TIMESTAMPTZ NULL,
  
  -- Sonuç (pasaport çıktı)
  sonuc TEXT NULL CHECK (sonuc IN ('vize_onay', 'red')),
  sonuc_tarihi TIMESTAMPTZ NULL,
  vize_bitis_tarihi DATE NULL,
  
  -- Atama ve arşiv
  assigned_user_id UUID NOT NULL REFERENCES public.profiles(id),
  arsiv_mi BOOLEAN DEFAULT FALSE,
  
  -- Zaman damgaları
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Updated_at trigger
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_visa_files_updated_at
  BEFORE UPDATE ON public.visa_files
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Visa files için RLS
ALTER TABLE public.visa_files ENABLE ROW LEVEL SECURITY;

-- Staff kendi dosyalarını görebilir
CREATE POLICY "Staff can view own files" ON public.visa_files
  FOR SELECT USING (assigned_user_id = auth.uid());

-- Admin tüm dosyaları görebilir
CREATE POLICY "Admins can view all files" ON public.visa_files
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Staff kendi dosyasına insert yapabilir
CREATE POLICY "Staff can insert own files" ON public.visa_files
  FOR INSERT WITH CHECK (assigned_user_id = auth.uid());

-- Admin herhangi bir dosya ekleyebilir
CREATE POLICY "Admins can insert any file" ON public.visa_files
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Staff kendi dosyasını güncelleyebilir
CREATE POLICY "Staff can update own files" ON public.visa_files
  FOR UPDATE USING (assigned_user_id = auth.uid());

-- Admin tüm dosyaları güncelleyebilir
CREATE POLICY "Admins can update all files" ON public.visa_files
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 3. PAYMENTS TABLOSU
-- ============================================
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  file_id UUID NOT NULL REFERENCES public.visa_files(id) ON DELETE CASCADE,
  tutar NUMERIC NOT NULL,
  yontem TEXT NOT NULL CHECK (yontem IN ('nakit', 'hesaba', 'cari')),
  durum TEXT NOT NULL DEFAULT 'odendi' CHECK (durum IN ('odendi', 'odenmedi')),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  created_by UUID NOT NULL REFERENCES public.profiles(id)
);

-- Payments için RLS
ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

-- Staff kendi dosyalarının ödemelerini görebilir
CREATE POLICY "Staff can view payments of own files" ON public.payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.visa_files 
      WHERE visa_files.id = payments.file_id 
      AND visa_files.assigned_user_id = auth.uid()
    )
  );

-- Admin tüm ödemeleri görebilir
CREATE POLICY "Admins can view all payments" ON public.payments
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Staff kendi dosyasına ödeme ekleyebilir
CREATE POLICY "Staff can insert payments for own files" ON public.payments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.visa_files 
      WHERE visa_files.id = file_id 
      AND visa_files.assigned_user_id = auth.uid()
    )
  );

-- Admin herhangi bir dosyaya ödeme ekleyebilir
CREATE POLICY "Admins can insert any payment" ON public.payments
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ============================================
-- 4. ACTIVITY_LOGS TABLOSU
-- ============================================
CREATE TABLE IF NOT EXISTS public.activity_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  type TEXT NOT NULL,
  message TEXT NOT NULL,
  file_id UUID NULL REFERENCES public.visa_files(id) ON DELETE SET NULL,
  actor_id UUID NOT NULL REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Activity logs için RLS
ALTER TABLE public.activity_logs ENABLE ROW LEVEL SECURITY;

-- Staff kendi dosyalarının loglarını + kendi aksiyonlarını görebilir
CREATE POLICY "Staff can view own logs" ON public.activity_logs
  FOR SELECT USING (
    actor_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.visa_files 
      WHERE visa_files.id = activity_logs.file_id 
      AND visa_files.assigned_user_id = auth.uid()
    )
  );

-- Admin tüm logları görebilir
CREATE POLICY "Admins can view all logs" ON public.activity_logs
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Herkes log ekleyebilir (kendi adına)
CREATE POLICY "Users can insert own logs" ON public.activity_logs
  FOR INSERT WITH CHECK (actor_id = auth.uid());

-- ============================================
-- 5. NOTIFICATIONS TABLOSU
-- ============================================
CREATE TABLE IF NOT EXISTS public.notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  file_id UUID NULL REFERENCES public.visa_files(id) ON DELETE SET NULL,
  kind TEXT NOT NULL,
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  scheduled_for TIMESTAMPTZ NULL,
  sent_at TIMESTAMPTZ NULL,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  unique_key TEXT NULL
);

-- Unique key için index (aynı bildirimi 2 kez üretmemek için)
CREATE UNIQUE INDEX IF NOT EXISTS notifications_unique_key_idx 
  ON public.notifications(unique_key) 
  WHERE unique_key IS NOT NULL;

-- Notifications için RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Kullanıcı sadece kendi bildirimlerini görebilir
CREATE POLICY "Users can view own notifications" ON public.notifications
  FOR SELECT USING (user_id = auth.uid());

-- Admin tüm bildirimleri görebilir
CREATE POLICY "Admins can view all notifications" ON public.notifications
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Kullanıcı kendi bildirimlerini güncelleyebilir (okundu işareti için)
CREATE POLICY "Users can update own notifications" ON public.notifications
  FOR UPDATE USING (user_id = auth.uid());

-- Admin bildirim ekleyebilir
CREATE POLICY "Admins can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles 
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- Staff da bildirim ekleyebilir (dosya hazır olduğunda admin'e)
CREATE POLICY "Staff can insert notifications" ON public.notifications
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

-- ============================================
-- 6. INTERNAL_MESSAGES TABLOSU (İç Mesajlaşma)
-- ============================================
CREATE TABLE IF NOT EXISTS public.internal_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  receiver_id UUID NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  message TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  read_at TIMESTAMPTZ NULL,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Internal Messages için RLS
ALTER TABLE public.internal_messages ENABLE ROW LEVEL SECURITY;

-- Kullanıcı aldığı veya gönderdiği mesajları görebilir
CREATE POLICY "Users can view own messages" ON public.internal_messages
  FOR SELECT USING (sender_id = auth.uid() OR receiver_id = auth.uid());

-- Kullanıcı mesaj gönderebilir
CREATE POLICY "Users can send messages" ON public.internal_messages
  FOR INSERT WITH CHECK (sender_id = auth.uid());

-- Kullanıcı aldığı mesajları güncelleyebilir (okundu işareti)
CREATE POLICY "Users can update received messages" ON public.internal_messages
  FOR UPDATE USING (receiver_id = auth.uid());

CREATE INDEX IF NOT EXISTS internal_messages_sender_idx ON public.internal_messages(sender_id);
CREATE INDEX IF NOT EXISTS internal_messages_receiver_idx ON public.internal_messages(receiver_id);

-- ============================================
-- 7. İNDEXLER
-- ============================================
CREATE INDEX IF NOT EXISTS visa_files_assigned_user_idx ON public.visa_files(assigned_user_id);
CREATE INDEX IF NOT EXISTS visa_files_randevu_tarihi_idx ON public.visa_files(randevu_tarihi);
CREATE INDEX IF NOT EXISTS visa_files_vize_bitis_tarihi_idx ON public.visa_files(vize_bitis_tarihi);
CREATE INDEX IF NOT EXISTS visa_files_arsiv_idx ON public.visa_files(arsiv_mi);
CREATE INDEX IF NOT EXISTS payments_file_id_idx ON public.payments(file_id);
CREATE INDEX IF NOT EXISTS activity_logs_file_id_idx ON public.activity_logs(file_id);
CREATE INDEX IF NOT EXISTS activity_logs_actor_id_idx ON public.activity_logs(actor_id);
CREATE INDEX IF NOT EXISTS notifications_user_id_idx ON public.notifications(user_id);
CREATE INDEX IF NOT EXISTS notifications_scheduled_for_idx ON public.notifications(scheduled_for);
