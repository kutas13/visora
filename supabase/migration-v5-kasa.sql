-- V5: Kasa system

create table if not exists public.kasa_transactions (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  kasa text not null check (kasa in ('TL', 'EUR', 'USD')),
  type text not null default 'gelir' check (type in ('gelir', 'gider')),
  amount numeric(12,2) not null,
  description text,
  created_at timestamptz not null default now()
);
alter table public.kasa_transactions enable row level security;
drop policy if exists "allow_all_kasa" on public.kasa_transactions;
create policy "allow_all_kasa" on public.kasa_transactions for all to public using (true) with check (true);

create table if not exists public.bank_cards (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  bank_name text not null,
  card_type text not null default 'banka',
  last_four text not null,
  balance numeric(12,2) not null default 0,
  created_at timestamptz not null default now()
);
alter table public.bank_cards enable row level security;
drop policy if exists "allow_all_cards" on public.bank_cards;
create policy "allow_all_cards" on public.bank_cards for all to public using (true) with check (true);
