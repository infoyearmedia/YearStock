-- YearMedia — Supabase / PostgreSQL schema (001_schema.sql)
-- Run in the Supabase SQL editor (or psql) against your project.
-- The API currently runs in local/demo mode (in-memory + JSON file store);
-- this schema is for the future Supabase wiring. No data is migrated yet.

-- Extensions
create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- profiles: one row per auth user (auth.users is managed by Supabase Auth)
-- ---------------------------------------------------------------------------
create table if not exists public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  email text not null,
  plan text not null default 'free' check (plan in ('free', 'pro', 'premium')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- subscriptions: plan + billing period
-- ---------------------------------------------------------------------------
create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  plan text not null check (plan in ('free', 'pro', 'premium')),
  period_months integer not null check (period_months in (1, 6, 12, 60)),
  status text not null default 'active' check (status in ('active', 'cancelled', 'expired', 'past_due')),
  starts_at timestamptz not null default now(),
  ends_at timestamptz,
  provider text,              -- e.g. 'stripe' once payments are connected
  provider_subscription_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- assets: uploaded stock assets
-- ---------------------------------------------------------------------------
create table if not exists public.assets (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  filename text not null,
  original_filename text,
  marketplace text,           -- adobe | shutterstock | freepik | dreamstime | 123rf | istock | alamy
  file_size_bytes bigint,
  width integer,
  height integer,
  format text,
  storage_path text,          -- Supabase Storage path, once wired
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- jobs: one row per tool run (metadata, quality, remove-bg, upscale, convert)
-- ---------------------------------------------------------------------------
create table if not exists public.jobs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  asset_id uuid references public.assets (id) on delete set null,
  tool text not null,          -- metadata | quality | remove-bg | upscale | convert | embed
  status text not null default 'queued' check (status in ('queued', 'processing', 'done', 'failed')),
  input jsonb not null default '{}'::jsonb,
  output jsonb,
  error text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- history: user-visible asset/tool history (mirrors the API /api/history)
-- ---------------------------------------------------------------------------
create table if not exists public.history (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users (id) on delete cascade,
  asset_name text not null,
  tool text not null,
  marketplace text,
  result_summary text,
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Indexes
-- ---------------------------------------------------------------------------
create index if not exists idx_subscriptions_user_id on public.subscriptions (user_id);
create index if not exists idx_subscriptions_user_status on public.subscriptions (user_id, status);
create index if not exists idx_assets_user_id on public.assets (user_id);
create index if not exists idx_assets_created_at on public.assets (created_at desc);
create index if not exists idx_jobs_user_id on public.jobs (user_id);
create index if not exists idx_jobs_tool_status on public.jobs (tool, status);
create index if not exists idx_history_user_id on public.history (user_id);
create index if not exists idx_history_created_at on public.history (user_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Row Level Security
-- ---------------------------------------------------------------------------
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.assets enable row level security;
alter table public.jobs enable row level security;
alter table public.history enable row level security;

-- TODO: review these policies before going live. They are a starting point:
-- each user may only read/write their own rows. Service-role key bypasses
-- RLS for server-side jobs; anon users get nothing by default.
-- TODO: add an admin/service policy if a backend worker needs cross-user access.

-- profiles: users can read/update their own profile
create policy "profiles_select_own" on public.profiles
  for select using (auth.uid() = id);
create policy "profiles_update_own" on public.profiles
  for update using (auth.uid() = id);

-- subscriptions: users can read their own subscriptions
create policy "subscriptions_select_own" on public.subscriptions
  for select using (auth.uid() = user_id);

-- assets: users own their assets
create policy "assets_select_own" on public.assets
  for select using (auth.uid() = user_id);
create policy "assets_insert_own" on public.assets
  for insert with check (auth.uid() = user_id);
create policy "assets_update_own" on public.assets
  for update using (auth.uid() = user_id);
create policy "assets_delete_own" on public.assets
  for delete using (auth.uid() = user_id);

-- jobs: users own their jobs
create policy "jobs_select_own" on public.jobs
  for select using (auth.uid() = user_id);
create policy "jobs_insert_own" on public.jobs
  for insert with check (auth.uid() = user_id);
create policy "jobs_update_own" on public.jobs
  for update using (auth.uid() = user_id);

-- history: users own their history
create policy "history_select_own" on public.history
  for select using (auth.uid() = user_id);
create policy "history_insert_own" on public.history
  for insert with check (auth.uid() = user_id);
create policy "history_delete_own" on public.history
  for delete using (auth.uid() = user_id);
