-- ============================================================
-- 042 — bank_accounts unique constraint'ini para birimi bazli yap
--   027 numarali migration'da (organization_id, name) UNIQUE'di;
--   ayni isimde TL + EUR + USD acilamiyordu. Artik (organization_id,
--   name, currency) UNIQUE → ayni isim farkli para birimlerinde
--   olabilir.
-- Idempotent.
-- ============================================================

ALTER TABLE public.bank_accounts
  DROP CONSTRAINT IF EXISTS bank_accounts_unique_name_per_org;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
      FROM pg_constraint
     WHERE conname = 'bank_accounts_unique_name_currency_per_org'
       AND conrelid = 'public.bank_accounts'::regclass
  ) THEN
    ALTER TABLE public.bank_accounts
      ADD CONSTRAINT bank_accounts_unique_name_currency_per_org
        UNIQUE (organization_id, name, currency);
  END IF;
END
$$;

NOTIFY pgrst, 'reload schema';
