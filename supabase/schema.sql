-- FTV Dashboard Auth schema
-- À exécuter dans Supabase SQL Editor une seule fois.

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  full_name text,
  role text not null default 'viewer' check (role in ('admin','editor','viewer')),
  status text not null default 'active' check (status in ('active','disabled')),
  created_at timestamptz not null default now(),
  last_seen_at timestamptz
);

alter table public.profiles enable row level security;

-- Les accès de lecture/écriture côté app passent par les routes Vercel avec la service role key.
-- On ne donne donc pas d'accès direct public aux profils.

drop policy if exists "profiles_no_public_access" on public.profiles;
create policy "profiles_no_public_access"
  on public.profiles
  for all
  using (false)
  with check (false);

create index if not exists profiles_email_idx on public.profiles(email);
create index if not exists profiles_role_idx on public.profiles(role);
create index if not exists profiles_status_idx on public.profiles(status);
