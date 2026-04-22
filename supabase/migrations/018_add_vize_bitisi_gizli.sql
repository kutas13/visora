-- Vize Bitişi Takibi sayfasından kayıtları gizlemek için flag
-- Dosyanın kendisi silinmez; sadece bu sayfadaki listeden kaldırılır.

ALTER TABLE public.visa_files
ADD COLUMN IF NOT EXISTS vize_bitisi_gizli BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN public.visa_files.vize_bitisi_gizli IS
  'TRUE ise dosya "Vize Bitişi Takibi" sayfasından gizlenir, ancak dosya silinmez.';
