-- Standalone vize görseli yüklemeleri için tablo
CREATE TABLE IF NOT EXISTS vize_gorselleri_uploads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  gorsel_url TEXT NOT NULL,
  gorsel_adi TEXT NOT NULL,
  sira_no INTEGER NOT NULL DEFAULT 1,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE vize_gorselleri_uploads ENABLE ROW LEVEL SECURITY;

-- Staff kendi görsellerini görebilir
CREATE POLICY "staff_select_own" ON vize_gorselleri_uploads
  FOR SELECT USING (auth.uid() = user_id);

-- Staff kendi görsellerini ekleyebilir
CREATE POLICY "staff_insert_own" ON vize_gorselleri_uploads
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Staff kendi görsellerini güncelleyebilir
CREATE POLICY "staff_update_own" ON vize_gorselleri_uploads
  FOR UPDATE USING (auth.uid() = user_id);

-- Staff kendi görsellerini silebilir
CREATE POLICY "staff_delete_own" ON vize_gorselleri_uploads
  FOR DELETE USING (auth.uid() = user_id);

-- Admin tüm görselleri görebilir
CREATE POLICY "admin_select_all" ON vize_gorselleri_uploads
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admin tüm görselleri silebilir
CREATE POLICY "admin_delete_all" ON vize_gorselleri_uploads
  FOR DELETE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );

-- Admin tüm görselleri güncelleyebilir
CREATE POLICY "admin_update_all" ON vize_gorselleri_uploads
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role = 'admin')
  );
