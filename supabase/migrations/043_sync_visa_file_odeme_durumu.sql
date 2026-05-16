-- ============================================================
-- 043 — visa_files.odeme_durumu otomatik senkronu (payments ile)
--
-- Sorun: Bir cari dosyaya tahsilat alindiktan sonra dosya yeniden
-- duzenlendiginde (VisaFileForm) odeme_durumu yanlislikla 'odenmedi'
-- olarak sifirlaniyordu. Form tarafi duzeltildi; bu migration:
--
--   1) payments insert/update/delete sonrasi visa_files.odeme_durumu'nu
--      her zaman dogru tutmak icin bir trigger ekler:
--        - dosyada en az 1 tahsilat (payment_type='tahsilat', durum='odendi')
--          varsa  → visa_files.odeme_durumu = 'odendi'
--        - hicbir tahsilat yoksa → 'odenmedi'
--      (Sadece odeme_plani='cari' olan dosyalar etkilenir; pesin satislar
--       form aninda 'odendi' olarak yazilir, dokunulmaz.)
--   2) Backfill: payments tablosunda kaydi olup hala 'odenmedi' goruken
--      tum cari dosyalari toplu olarak 'odendi'ye cevirir.
--
-- Idempotent.
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_visa_file_odeme_durumu()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  fid UUID;
  has_pay BOOLEAN;
BEGIN
  fid := COALESCE(NEW.file_id, OLD.file_id);
  IF fid IS NULL THEN
    RETURN COALESCE(NEW, OLD);
  END IF;

  SELECT EXISTS (
    SELECT 1
      FROM public.payments
     WHERE file_id = fid
       AND payment_type = 'tahsilat'
       AND durum = 'odendi'
  ) INTO has_pay;

  UPDATE public.visa_files
     SET odeme_durumu = CASE WHEN has_pay THEN 'odendi' ELSE 'odenmedi' END
   WHERE id = fid
     AND odeme_plani = 'cari'
     AND odeme_durumu IS DISTINCT FROM CASE WHEN has_pay THEN 'odendi' ELSE 'odenmedi' END;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS payments_sync_odeme_durumu_ai ON public.payments;
CREATE TRIGGER payments_sync_odeme_durumu_ai
AFTER INSERT OR UPDATE OR DELETE ON public.payments
FOR EACH ROW EXECUTE FUNCTION public.sync_visa_file_odeme_durumu();

-- ------------------------------------------------------------
-- Backfill: tutarsiz mevcut kayitlari onar
-- ------------------------------------------------------------

-- Cari + tahsilat alinmis ama hala 'odenmedi' goruken dosyalar → 'odendi'
UPDATE public.visa_files vf
   SET odeme_durumu = 'odendi'
 WHERE vf.odeme_plani = 'cari'
   AND vf.odeme_durumu = 'odenmedi'
   AND EXISTS (
     SELECT 1
       FROM public.payments p
      WHERE p.file_id = vf.id
        AND p.payment_type = 'tahsilat'
        AND p.durum = 'odendi'
   );

NOTIFY pgrst, 'reload schema';
