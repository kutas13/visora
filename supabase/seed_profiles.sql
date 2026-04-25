-- =============================================================================
-- Manuel profil (profiles) — İSTEĞE BAĞLI
-- =============================================================================
--
-- HATA 23503 (profiles_id_fkey): profiles.id, mutlaka auth.users içinde VAR
-- olan bir kullanıcının id'si olmalı. Aşağıdaki eski Fox örnek UUID'leri
-- sizin projenizde YOKTUR; doğrudan çalıştırırsanız FK hatası alırsınız.
--
-- Doğru sıra:
--   1) Supabase → Authentication → kullanıcı oluştur (e-posta + şifre).
--   2) SQL Editor: SELECT id, email FROM auth.users;  ile gerçek UUID'leri kopyala.
--   3) (SaaS / 021 uygulandıysa) organizations tablosunda firma satırın olsun;
--      SELECT id, name FROM public.organizations;
--   4) Aşağıdaki INSERT'i kendi id / organization_id değerlerinizle doldurup çalıştırın.
--
-- Visora SaaS — boş projede önerilen yol:
--   POST /api/platform/provision-organization (header: x-visora-platform-secret)
--   → firma + genel müdür auth kullanıcısı + profil otomatik (trigger) oluşur.
--
-- HATA 42703 (organization_id yok): Önce tüm migration'ları sırayla çalıştırın;
-- organization_id kolonu 021_saas_organizations.sql ile profiles'a eklenir.
--
-- =============================================================================

/*
-- ÖRNEK — UUID'leri KENDİ auth.users.id ve organizations.id ile değiştirin:

INSERT INTO public.profiles (id, name, role, organization_id) VALUES
  ('00000000-0000-0000-0000-000000000001', 'GENEL MÜDÜR', 'admin', '00000000-0000-0000-0000-000000000002'::uuid)
ON CONFLICT (id) DO UPDATE SET
  name = EXCLUDED.name,
  role = EXCLUDED.role,
  organization_id = COALESCE(EXCLUDED.organization_id, public.profiles.organization_id);
*/

-- Eski Fox Turizm sabit UUID'leri kaldırıldı (yeni projede auth.users'ta olmadığı için FK kırılıyordu).
