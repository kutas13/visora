-- V4: Cari system, companies, staff avatar on files

-- Companies table for firma cari
create table if not exists public.companies (
  id uuid primary key default gen_random_uuid(),
  agency_id uuid not null references public.agencies(id) on delete cascade,
  firma_adi text not null,
  created_at timestamptz not null default now()
);
alter table public.companies enable row level security;
drop policy if exists "allow_all_companies" on public.companies;
create policy "allow_all_companies" on public.companies for all to public using (true) with check (true);

-- Add cari fields to applications
alter table public.applications add column if not exists cari_tipi text;
alter table public.applications add column if not exists cari_sahibi text;
alter table public.applications add column if not exists company_id uuid references public.companies(id);
alter table public.applications add column if not exists evrak_durumu text default 'gelmedi';
alter table public.applications add column if not exists evrak_eksik_mi boolean default false;
alter table public.applications add column if not exists evrak_not text;
alter table public.applications add column if not exists sonuc_tarihi date;
