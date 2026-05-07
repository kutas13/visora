-- 032: İlk giriş şifre değiştirme zorunluluğu + GM şifre görüntüleme
-- Owner GM oluştururken veya GM personel oluştururken must_change_password = true set edilir.
-- Kullanıcı ilk girişte şifresini değiştirince false olur.

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS must_change_password BOOLEAN NOT NULL DEFAULT false;

COMMENT ON COLUMN public.profiles.must_change_password
  IS 'true ise kullanıcı ilk girişte şifresini değiştirmek zorundadır';

-- Owner'ın oluşturduğu GM'in geçici şifresini saklar (GM şifresini değiştirince silinir)
ALTER TABLE public.organizations
  ADD COLUMN IF NOT EXISTS admin_initial_password TEXT;
