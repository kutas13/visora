-- ---------------------------------------------------------------------------
-- 039: profiles.is_active eklenir.
-- Genel mudur (admin) personeli devre disi birakabilsin.
-- ---------------------------------------------------------------------------

ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

CREATE INDEX IF NOT EXISTS profiles_is_active_idx
  ON public.profiles (organization_id, is_active);

-- Geriye donuk: mevcut tum kullanicilar aktif kabul edilir
UPDATE public.profiles SET is_active = TRUE WHERE is_active IS NULL;

NOTIFY pgrst, 'reload schema';
