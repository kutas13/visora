-- Staff kendi carisindeki dosyaları da görebilsin (assigned_user_id farklı olsa bile)
CREATE POLICY "Staff can view cari files" ON public.visa_files
  FOR SELECT USING (
    cari_sahibi IS NOT NULL AND
    UPPER(cari_sahibi) = UPPER((SELECT name FROM public.profiles WHERE id = auth.uid()))
  );

-- Staff kendi carisindeki dosyaları güncelleyebilsin (tahsilat için odeme_durumu değiştirmek)
CREATE POLICY "Staff can update cari files" ON public.visa_files
  FOR UPDATE USING (
    cari_sahibi IS NOT NULL AND
    UPPER(cari_sahibi) = UPPER((SELECT name FROM public.profiles WHERE id = auth.uid()))
  );
