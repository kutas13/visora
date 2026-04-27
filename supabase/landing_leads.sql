-- Landing page'den gelen iletişim formları (lead'ler)
-- Owner paneldeki "Formlar" sayfasında gösterilir.

create table if not exists public.landing_leads (
  id uuid primary key default gen_random_uuid(),
  ad text not null,
  soyad text not null,
  iletisim_no text not null,
  not text,
  durum text not null default 'yeni' check (durum in ('yeni', 'iletisim_kuruldu', 'kapatildi')),
  ip_adresi text,
  user_agent text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists landing_leads_created_at_idx on public.landing_leads(created_at desc);
create index if not exists landing_leads_durum_idx on public.landing_leads(durum);

alter table public.landing_leads enable row level security;

-- Anonim kullanıcılar form gönderebilir (insert)
drop policy if exists "anyone can submit leads" on public.landing_leads;
create policy "anyone can submit leads"
  on public.landing_leads for insert
  to anon, authenticated
  with check (true);

-- Sadece platform_owner görebilir/düzenleyebilir
drop policy if exists "platform owner can read leads" on public.landing_leads;
create policy "platform owner can read leads"
  on public.landing_leads for select
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'platform_owner'
    )
  );

drop policy if exists "platform owner can update leads" on public.landing_leads;
create policy "platform owner can update leads"
  on public.landing_leads for update
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'platform_owner'
    )
  );

drop policy if exists "platform owner can delete leads" on public.landing_leads;
create policy "platform owner can delete leads"
  on public.landing_leads for delete
  to authenticated
  using (
    exists (
      select 1 from public.profiles
      where profiles.id = auth.uid() and profiles.role = 'platform_owner'
    )
  );
