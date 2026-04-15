-- Storage bucket for file uploads (replaces base64 in DB)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'uploads',
  'uploads',
  true,
  52428800, -- 50MB
  ARRAY['image/jpeg', 'image/png', 'image/gif', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

-- Public read access
CREATE POLICY "uploads_public_read" ON storage.objects
  FOR SELECT USING (bucket_id = 'uploads');

-- Authenticated users can upload
CREATE POLICY "uploads_auth_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'uploads' AND auth.role() = 'authenticated');

-- Authenticated users can update their uploads
CREATE POLICY "uploads_auth_update" ON storage.objects
  FOR UPDATE USING (bucket_id = 'uploads' AND auth.role() = 'authenticated');

-- Authenticated users can delete
CREATE POLICY "uploads_auth_delete" ON storage.objects
  FOR DELETE USING (bucket_id = 'uploads' AND auth.role() = 'authenticated');
