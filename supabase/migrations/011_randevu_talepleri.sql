-- Randevu Talepleri tablosu
CREATE TABLE IF NOT EXISTS public.randevu_talepleri (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  ulkeler TEXT[] NOT NULL DEFAULT '{}',
  vize_tipi TEXT NOT NULL, -- turistik, ticari, ogrenci, konferans, aile, arkadas
  alt_kategori TEXT, -- ilk_vize, multi_vize (sadece Fransa + turistik)
  dosya_adi TEXT NOT NULL,
  iletisim TEXT NOT NULL,
  gorseller TEXT[] DEFAULT '{}', -- base64 veya URL
  randevu_tarihi TIMESTAMPTZ,
  randevu_alan_id UUID REFERENCES public.profiles(id),
  arsivlendi BOOLEAN DEFAULT FALSE,
  created_by UUID REFERENCES public.profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_randevu_talepleri_arsivlendi ON public.randevu_talepleri(arsivlendi);
CREATE INDEX IF NOT EXISTS idx_randevu_talepleri_created_at ON public.randevu_talepleri(created_at DESC);

ALTER TABLE public.randevu_talepleri ENABLE ROW LEVEL SECURITY;

CREATE POLICY "randevu_talepleri_select" ON public.randevu_talepleri
  FOR SELECT USING (true);

CREATE POLICY "randevu_talepleri_insert" ON public.randevu_talepleri
  FOR INSERT WITH CHECK (true);

CREATE POLICY "randevu_talepleri_update" ON public.randevu_talepleri
  FOR UPDATE USING (true);

CREATE POLICY "randevu_talepleri_delete" ON public.randevu_talepleri
  FOR DELETE USING (true);
