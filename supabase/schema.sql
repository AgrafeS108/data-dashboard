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


-- V94 : watchlist synchronisée par utilisateur.
create table if not exists public.user_watchlist (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null,
  event_key text not null,
  created_at timestamptz not null default now(),
  unique(user_id, channel, event_key)
);

alter table public.user_watchlist enable row level security;

drop policy if exists "user_watchlist_no_public_access" on public.user_watchlist;
create policy "user_watchlist_no_public_access"
  on public.user_watchlist
  for all
  using (false)
  with check (false);

create index if not exists user_watchlist_user_channel_idx on public.user_watchlist(user_id, channel);
