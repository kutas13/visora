-- ============================================================
-- 025 — Abonelik DENEME SÜRESİ (15 gün)
--   - platform_subscriptions tablosuna trial_ends_at eklenir
--   - ensure_platform_invoices artık deneme süresi bittikten
--     sonraki ilk aydan itibaren tahakkuk üretir
--   - Mevcut abonelikler için (NULL) deneme süresi yokmuş kabul
--     edilir (geriye dönük etki yok)
-- Idempotent: tekrar tekrar güvenle çalıştırılabilir.
-- ============================================================

-- ------------------------------------------------------------
-- 1) trial_ends_at kolonu
-- ------------------------------------------------------------
ALTER TABLE public.platform_subscriptions
  ADD COLUMN IF NOT EXISTS trial_ends_at DATE;

COMMENT ON COLUMN public.platform_subscriptions.trial_ends_at IS
  'Ücretsiz deneme süresinin bittiği tarih. Bu tarihten sonraki ilk aydan itibaren ücretli abonelik tahakkukları başlar. NULL ise deneme süresi yok (geriye dönük abonelikler).';

-- ------------------------------------------------------------
-- 2) ensure_platform_invoices: deneme süresini dikkate al
-- ------------------------------------------------------------
CREATE OR REPLACE FUNCTION public.ensure_platform_invoices(p_organization_id UUID)
RETURNS INT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $epi$
DECLARE
  sub RECORD;
  cur_y INT;
  cur_m INT;
  iter DATE;
  end_d DATE;
  start_d DATE;
  inserted_count INT := 0;
BEGIN
  IF NOT public.is_platform_owner() THEN
    RAISE EXCEPTION 'PERMISSION_DENIED';
  END IF;

  SELECT * INTO sub FROM public.platform_subscriptions WHERE organization_id = p_organization_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;

  -- Tahakkuk başlangıcı:
  --   trial_ends_at varsa → o tarihin AYI (deneme bittikten sonra ilk ücretli ay
  --   o ay içinde başladığı için yine o ay tahakkuk edilir),
  --   yoksa → abonelik started_at ayı.
  IF sub.trial_ends_at IS NOT NULL THEN
    start_d := date_trunc('month', sub.trial_ends_at)::date;
  ELSE
    start_d := date_trunc('month', sub.started_at)::date;
  END IF;

  iter := start_d;
  end_d := date_trunc('month', CURRENT_DATE)::date;

  WHILE iter <= end_d LOOP
    cur_y := EXTRACT(YEAR FROM iter)::INT;
    cur_m := EXTRACT(MONTH FROM iter)::INT;

    INSERT INTO public.platform_payments (organization_id, period_year, period_month, amount, currency)
    VALUES (p_organization_id, cur_y, cur_m, sub.monthly_fee, sub.currency)
    ON CONFLICT (organization_id, period_year, period_month) DO NOTHING;

    GET DIAGNOSTICS inserted_count = ROW_COUNT;
    iter := (iter + INTERVAL '1 month')::date;
  END LOOP;

  RETURN inserted_count;
END;
$epi$;

GRANT EXECUTE ON FUNCTION public.ensure_platform_invoices(UUID) TO authenticated;

-- ------------------------------------------------------------
-- 3) PostgREST cache reload
-- ------------------------------------------------------------
NOTIFY pgrst, 'reload schema';
