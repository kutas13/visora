-- =========================================================
-- Google Yorum WhatsApp Mesajı Takibi
-- =========================================================
-- Vize onaylandıktan 3 gün sonra müşteriye Google yorum
-- linki WhatsApp üzerinden gönderilir. Aynı müşteriye birden
-- fazla mesaj gitmemesi için gönderim tarihi loglanır.
-- =========================================================

ALTER TABLE public.visa_files
  ADD COLUMN IF NOT EXISTS google_review_msg_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN public.visa_files.google_review_msg_sent_at IS
  'Google yorum isteği WhatsApp mesajının gönderildiği zaman. NULL ise henüz gönderilmemiştir.';

-- Schema cache reload
NOTIFY pgrst, 'reload schema';
