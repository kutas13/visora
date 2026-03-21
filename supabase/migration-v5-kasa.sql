-- V5: Kasa, banka kartları, kredi kartları

-- Kasa işlemleri
create table if not exists public.kasa_transactions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  kasa_type text not null check (kasa_type in ('TL', 'EUR', 'USD')),
  amount numeric(12,2) not null,
  description text,
  transaction_type text not null default 'gelir',
  created_at timestamptz not null default now()
);
alter table public.kasa_transactions enable row level security;
drop policy if exists "allow_all_kasa" on public.kasa_transactions;
create policy "allow_all_kasa" on public.kasa_transactions for all to public using (true) with check (true);

-- Banka/Kredi kartları
create table if not exists public.bank_cards (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  bank_name text not null,
  card_type text not null check (card_type in ('banka', 'kredi')),
  last_four text not null,
  balance numeric(12,2) not null default 0,
  credit_limit numeric(12,2),
  ekstre_kesim_gun integer,
  created_at timestamptz not null default now()
);
alter table public.bank_cards enable row level security;
drop policy if exists "allow_all_cards" on public.bank_cards;
create policy "allow_all_cards" on public.bank_cards for all to public using (true) with check (true);

-- Kart işlemleri (borç ödeme vs)
create table if not exists public.card_transactions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  card_id uuid not null references public.bank_cards(id) on delete cascade,
  amount numeric(12,2) not null,
  description text,
  transaction_type text not null default 'odeme',
  source text,
  created_at timestamptz not null default now()
);
alter table public.card_transactions enable row level security;
drop policy if exists "allow_all_card_tx" on public.card_transactions;
create policy "allow_all_card_tx" on public.card_transactions for all to public using (true) with check (true);
