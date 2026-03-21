-- Fox Turizm - Kullanıcı Profilleri
-- Bu SQL'i Supabase SQL Editor'da çalıştırın

INSERT INTO public.profiles (id, name, role) VALUES
  ('d81c3235-d082-4563-a9b5-7c511cfbb8a5', 'DAVUT', 'admin'),
  ('0d09792b-687d-4610-99aa-2c2b29cb19fe', 'BAHAR', 'staff'),
  ('2422bf6a-aeaa-45fe-9920-6d6f796cb5da', 'ERCAN', 'staff'),
  ('dd6ad159-8135-4e33-bb43-696052940826', 'YUSUF', 'staff')
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role;
