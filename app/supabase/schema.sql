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

-- V98 — Client access, watchlist, alerts and usage tracking
create table if not exists public.profile_channel_access (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null,
  created_at timestamptz default now(),
  unique(user_id, channel)
);
alter table public.profile_channel_access enable row level security;
grant select, insert, update, delete on table public.profile_channel_access to service_role;
grant select on table public.profile_channel_access to authenticated;
drop policy if exists "Users read own channel access" on public.profile_channel_access;
create policy "Users read own channel access" on public.profile_channel_access for select to authenticated using (auth.uid() = user_id);
drop policy if exists "Service role manages channel access" on public.profile_channel_access;
create policy "Service role manages channel access" on public.profile_channel_access for all to service_role using (true) with check (true);

create table if not exists public.usage_events (
  id bigserial primary key,
  user_id uuid references auth.users(id) on delete set null,
  event_type text not null,
  channel text,
  meta jsonb default '{}'::jsonb,
  user_agent text,
  created_at timestamptz default now()
);
alter table public.usage_events enable row level security;
grant select, insert, update, delete on table public.usage_events to service_role;
drop policy if exists "Service role manages usage events" on public.usage_events;
create policy "Service role manages usage events" on public.usage_events for all to service_role using (true) with check (true);

create table if not exists public.alert_states (
  id bigserial primary key,
  user_id uuid not null references auth.users(id) on delete cascade,
  channel text not null,
  alert_key text not null,
  status text not null default 'open',
  priority text not null default 'medium',
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now(),
  unique(user_id, channel, alert_key)
);
alter table public.alert_states enable row level security;
grant select, insert, update, delete on table public.alert_states to service_role;
grant select, insert, update on table public.alert_states to authenticated;
drop policy if exists "Users manage own alert states" on public.alert_states;
create policy "Users manage own alert states" on public.alert_states for all to authenticated using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "Service role manages alert states" on public.alert_states;
create policy "Service role manages alert states" on public.alert_states for all to service_role using (true) with check (true);

grant usage, select on all sequences in schema public to service_role;

-- V112 — Admin source of truth: data snapshots stored server-side.
create table if not exists public.dashboard_channel_snapshots (
  channel text primary key,
  payload jsonb not null default '{}'::jsonb,
  video_count integer not null default 0,
  last_video_published_at timestamptz,
  source text not null default 'admin-refresh',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
alter table public.dashboard_channel_snapshots enable row level security;
grant select, insert, update, delete on table public.dashboard_channel_snapshots to service_role;
drop policy if exists "Service role manages dashboard snapshots" on public.dashboard_channel_snapshots;
create policy "Service role manages dashboard snapshots" on public.dashboard_channel_snapshots for all to service_role using (true) with check (true);

create table if not exists public.dashboard_analytics_snapshots (
  channel text not null,
  scope text not null,
  payload jsonb not null default '{}'::jsonb,
  row_count integer not null default 0,
  source text not null default 'admin-refresh',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key(channel, scope)
);
alter table public.dashboard_analytics_snapshots enable row level security;
grant select, insert, update, delete on table public.dashboard_analytics_snapshots to service_role;
drop policy if exists "Service role manages dashboard analytics snapshots" on public.dashboard_analytics_snapshots;
create policy "Service role manages dashboard analytics snapshots" on public.dashboard_analytics_snapshots for all to service_role using (true) with check (true);

create index if not exists dashboard_channel_snapshots_updated_idx on public.dashboard_channel_snapshots(updated_at desc);
create index if not exists dashboard_analytics_snapshots_updated_idx on public.dashboard_analytics_snapshots(updated_at desc);
