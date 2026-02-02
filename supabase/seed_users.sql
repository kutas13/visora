-- Fox Turizm - Kullanıcı Seed Kılavuzu
-- =============================================
-- 
-- Supabase Dashboard'da aşağıdaki adımları izleyin:
--
-- 1. Authentication > Users > "Add user" ile kullanıcıları oluşturun:
--
--    Email: info@foxturizm.com (DAVUT - Admin)
--    Password: (güçlü bir şifre belirleyin)
--
--    Email: vize@foxturizm.com (BAHAR - Staff)
--    Password: (güçlü bir şifre belirleyin)
--
--    Email: ercan@foxturizm.com (ERCAN - Staff)
--    Password: (güçlü bir şifre belirleyin)
--
--    Email: yusuf@foxturizm.com (YUSUF - Staff)
--    Password: (güçlü bir şifre belirleyin)
--
-- 2. Her kullanıcı oluşturulduktan sonra UUID'lerini kopyalayın
--
-- 3. Aşağıdaki INSERT'leri gerçek UUID'lerle güncelleyip SQL Editor'da çalıştırın:

-- NOT: Aşağıdaki UUID'leri gerçek kullanıcı UUID'leri ile değiştirin!

/*
INSERT INTO public.profiles (id, name, role) VALUES
  ('DAVUT_UUID_BURAYA', 'DAVUT', 'admin'),
  ('BAHAR_UUID_BURAYA', 'BAHAR', 'staff'),
  ('ERCAN_UUID_BURAYA', 'ERCAN', 'staff'),
  ('YUSUF_UUID_BURAYA', 'YUSUF', 'staff');
*/

-- Örnek (gerçek UUID'lerle):
-- INSERT INTO public.profiles (id, name, role) VALUES
--   ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'DAVUT', 'admin'),
--   ('b2c3d4e5-f6a7-8901-bcde-f12345678901', 'BAHAR', 'staff'),
--   ('c3d4e5f6-a7b8-9012-cdef-123456789012', 'ERCAN', 'staff'),
--   ('d4e5f6a7-b8c9-0123-def0-234567890123', 'YUSUF', 'staff');

-- =============================================
-- Otomatik profil oluşturma trigger'ı (opsiyonel)
-- Yeni kullanıcı kaydolduğunda otomatik profil oluşturur
-- =============================================

CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, name, role)
  VALUES (
    NEW.id,
    COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1)),
    COALESCE(NEW.raw_user_meta_data->>'role', 'staff')
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger'ı oluştur
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
