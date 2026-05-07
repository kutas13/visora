-- 034: Kullanıcı profil fotoğrafı
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
