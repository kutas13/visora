-- ============================================================
-- 045 — payments → cash_transactions trigger'a UPDATE etiketi
--
-- Bir vize dosyasinin pesin odeme yontemi/hesabi/tutari sonradan
-- duzenlendiginde mevcut payments satiri UPDATE edilir (yeni INSERT
-- yapilmaz). Bu durumda trigger UPDATE durumunda cash_transactions'in
-- description'ina "(Düzenlendi)" eki yazar; boylece Kasa hareket
-- gecmisinde bu hareketin sonradan duzenlendigi anlasilir.
--
-- Idempotent: CREATE OR REPLACE FUNCTION.
-- ============================================================

CREATE OR REPLACE FUNCTION public.sync_payment_to_cash_tx()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  v_org UUID;
  v_account UUID;
  v_currency TEXT;
  v_amount NUMERIC;
  v_description TEXT;
  v_file_id UUID;
  v_musteri TEXT;
  v_edit_suffix TEXT;
BEGIN
  IF (TG_OP = 'DELETE') THEN
    DELETE FROM public.cash_transactions WHERE related_payment_id = OLD.id;
    RETURN OLD;
  END IF;

  -- Sadece odendi durumunda kasa hareketi olsun
  IF NEW.durum <> 'odendi' THEN
    DELETE FROM public.cash_transactions WHERE related_payment_id = NEW.id;
    RETURN NEW;
  END IF;

  -- file_id'den org cek
  SELECT vf.organization_id, vf.id, vf.musteri_ad
    INTO v_org, v_file_id, v_musteri
  FROM public.visa_files vf WHERE vf.id = NEW.file_id;

  IF v_org IS NULL THEN
    RETURN NEW;
  END IF;

  v_currency := COALESCE(NEW.currency, 'TL');
  v_amount := NEW.tutar;

  -- POS odemesi: TL nakit kasasina (asil tutar TL'dir; doviz pos_doviz_*)
  IF NEW.yontem = 'pos' THEN
    v_currency := 'TL';
    SELECT id INTO v_account FROM public.cash_accounts
    WHERE organization_id = v_org AND kind = 'cash' AND currency = 'TL' LIMIT 1;
  ELSIF NEW.yontem = 'nakit' THEN
    SELECT id INTO v_account FROM public.cash_accounts
    WHERE organization_id = v_org AND kind = 'cash' AND currency = v_currency LIMIT 1;
  ELSIF NEW.yontem = 'hesaba' AND NEW.hesap_sahibi IS NOT NULL THEN
    SELECT ca.id INTO v_account FROM public.cash_accounts ca
    JOIN public.bank_accounts ba ON ba.id = ca.bank_account_id
    WHERE ca.organization_id = v_org AND ca.kind = 'bank'
      AND ba.name = NEW.hesap_sahibi
    LIMIT 1;
  ELSE
    -- Cari odeme: kasaya yansimaz (tahsilat bekleniyor)
    DELETE FROM public.cash_transactions WHERE related_payment_id = NEW.id;
    RETURN NEW;
  END IF;

  IF v_account IS NULL THEN
    DELETE FROM public.cash_transactions WHERE related_payment_id = NEW.id;
    RETURN NEW;
  END IF;

  -- Duzenleme eki: payments UPDATE edildiyse (ornek: pesin yontem nakit→hesaba)
  -- description sonuna (Düzenlendi) yaz.
  v_edit_suffix := '';
  IF (TG_OP = 'UPDATE') THEN
    v_edit_suffix := ' (Düzenlendi)';
  END IF;

  v_description := COALESCE(v_musteri, 'Müşteri') || ' — '
    || CASE NEW.payment_type
         WHEN 'pesin_satis' THEN 'Peşin Satış'
         WHEN 'tahsilat' THEN 'Tahsilat'
         WHEN 'firma_cari' THEN 'Firma Cari'
         ELSE 'Ödeme'
       END
    || v_edit_suffix;

  -- Mevcut kayit varsa guncelle, yoksa olustur
  IF EXISTS (SELECT 1 FROM public.cash_transactions WHERE related_payment_id = NEW.id) THEN
    UPDATE public.cash_transactions
       SET account_id = v_account,
           amount = v_amount,
           currency = v_currency,
           description = v_description,
           organization_id = v_org
     WHERE related_payment_id = NEW.id;
  ELSE
    INSERT INTO public.cash_transactions
      (organization_id, account_id, direction, source, amount, currency,
       description, related_payment_id, created_by)
    VALUES
      (v_org, v_account, 'in', 'payment', v_amount, v_currency,
       v_description, NEW.id, NEW.created_by);
  END IF;

  RETURN NEW;
END;
$$;

-- Trigger DROP/CREATE gereksizdir; CREATE OR REPLACE FUNCTION trigger'i
-- bozmaz. Yine de garantilemek icin:
DROP TRIGGER IF EXISTS payments_sync_cash_tx ON public.payments;
CREATE TRIGGER payments_sync_cash_tx
  AFTER INSERT OR UPDATE OR DELETE ON public.payments
  FOR EACH ROW EXECUTE FUNCTION public.sync_payment_to_cash_tx();

NOTIFY pgrst, 'reload schema';
