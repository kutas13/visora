-- ============================================================
-- Visora Platform Owner (sahip) seed
-- Calistirmadan once 022_visora_platform_owner.sql uygulanmis olmali
--
-- Bu script:
-- 1) Supabase Authentication > Users altinda ZATEN olusturulmus
--    olan platform sahibi e-postasini bulur.
-- 2) Onun profiles satirini role='platform_owner' yapar.
--    Kayit yoksa olusturur. organization_id NULL kalir (sahip
--    bir sirkete bagli degil).
--
-- Eger kullanici Auth'ta yoksa, once Supabase Dashboard >
-- Authentication > Users > Add user ile olustur.
-- ============================================================

DO $owner$
DECLARE
  owner_email TEXT := 'gmyusuf13@gmail.com';   -- Platform sahibi e-postasi
  owner_name  TEXT := 'Visora Sahibi';
  uid UUID;
BEGIN
  SELECT id INTO uid FROM auth.users WHERE email = owner_email;

  IF uid IS NULL THEN
    RAISE EXCEPTION 'Auth''ta yok: % -> Once Supabase Dashboard > Authentication > Users > Add user',
      owner_email;
  END IF;

  INSERT INTO public.profiles (id, name, role, organization_id)
  VALUES (uid, owner_name, 'platform_owner', NULL)
  ON CONFLICT (id) DO UPDATE SET
    role = 'platform_owner',
    organization_id = NULL,
    name = COALESCE(public.profiles.name, EXCLUDED.name);

  RAISE NOTICE 'Platform owner ayarlandi: % (%)', owner_email, uid;
END $owner$;
