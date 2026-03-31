-- ============================================================================
-- Production-grade Supabase schema with strict multi-tenant RLS.
-- Threat model: frontend/client is fully compromised.
-- Identity source: auth.uid() only (never trust payload user_id).
-- ============================================================================

-- Required for gen_random_uuid()
create extension if not exists pgcrypto;

-- ============================================================================
-- 1) SCHEMA (CREATE TABLE)
-- ============================================================================

create table if not exists public.users (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null unique,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint users_email_format_chk check (position('@' in email) > 1)
);

create table if not exists public.subscriptions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  status text not null,
  plan text not null,
  current_period_end timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint subscriptions_status_chk check (
    status in (
      'trialing',
      'active',
      'past_due',
      'canceled',
      'unpaid',
      'incomplete',
      'incomplete_expired'
    )
  ),
  constraint subscriptions_plan_not_blank_chk check (length(trim(plan)) > 0)
);

create table if not exists public.payments (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  amount numeric(12, 2) not null,
  status text not null,
  provider text not null,
  external_id text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint payments_amount_nonnegative_chk check (amount >= 0),
  constraint payments_status_chk check (
    status in ('pending', 'succeeded', 'failed', 'refunded', 'chargeback')
  ),
  constraint payments_provider_not_blank_chk check (length(trim(provider)) > 0)
);

create table if not exists public.logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.users(id) on delete cascade,
  event text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  constraint logs_event_not_blank_chk check (length(trim(event)) > 0)
);

-- Keep mutable timestamps trustworthy.
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = public, pg_temp
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists trg_users_set_updated_at on public.users;
create trigger trg_users_set_updated_at
before update on public.users
for each row
execute function public.set_updated_at();

drop trigger if exists trg_subscriptions_set_updated_at on public.subscriptions;
create trigger trg_subscriptions_set_updated_at
before update on public.subscriptions
for each row
execute function public.set_updated_at();

-- Keep public.users in sync with auth.users without client-side insert permissions.
create or replace function public.handle_new_auth_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.users (id, email)
  values (new.id, coalesce(new.email, new.id::text || '@placeholder.local'))
  on conflict (id) do update
  set email = excluded.email;

  return new;
end;
$$;

revoke all on function public.handle_new_auth_user() from public;
grant execute on function public.handle_new_auth_user() to supabase_auth_admin;
grant execute on function public.handle_new_auth_user() to postgres;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_auth_user();

drop trigger if exists on_auth_user_updated on auth.users;
create trigger on_auth_user_updated
after update of email on auth.users
for each row execute function public.handle_new_auth_user();

-- ============================================================================
-- 2) LEAST-PRIVILEGE GRANTS (ROLE SEPARATION)
-- ============================================================================

-- Remove implicit access for public/anon/authenticated, then grant only what is needed.
revoke all on table public.users from public, anon, authenticated;
revoke all on table public.subscriptions from public, anon, authenticated;
revoke all on table public.payments from public, anon, authenticated;
revoke all on table public.logs from public, anon, authenticated;

grant select, update on table public.users to authenticated;
grant select, insert, update, delete on table public.subscriptions to authenticated;
grant select on table public.payments to authenticated;
grant select, insert on table public.logs to authenticated;

-- Backend-only full access path. Keep service_role secret server-side only.
grant all privileges on table public.users to service_role;
grant all privileges on table public.subscriptions to service_role;
grant all privileges on table public.payments to service_role;
grant all privileges on table public.logs to service_role;

-- ============================================================================
-- 3) ENABLE RLS ON ALL TABLES (DEFAULT DENY)
-- ============================================================================

alter table public.users enable row level security;
alter table public.subscriptions enable row level security;
alter table public.payments enable row level security;
alter table public.logs enable row level security;

-- Enforce RLS even for non-bypass table owners.
alter table public.users force row level security;
alter table public.subscriptions force row level security;
alter table public.payments force row level security;
alter table public.logs force row level security;

-- ============================================================================
-- 4) POLICIES (STRICT + COMPLETE)
-- ============================================================================

drop policy if exists users_select_own on public.users;
drop policy if exists users_update_own on public.users;
drop policy if exists subscriptions_select_own on public.subscriptions;
drop policy if exists subscriptions_insert_own on public.subscriptions;
drop policy if exists subscriptions_update_own on public.subscriptions;
drop policy if exists subscriptions_delete_own on public.subscriptions;
drop policy if exists payments_select_own on public.payments;
drop policy if exists logs_select_own on public.logs;
drop policy if exists logs_insert_own on public.logs;

-- users: allow authenticated users to read only their own profile row.
create policy users_select_own
on public.users
for select
to authenticated
using ((select auth.uid()) = id);

-- users: allow authenticated users to update only their own profile row.
-- WITH CHECK prevents changing ownership or writing another user's id.
create policy users_update_own
on public.users
for update
to authenticated
using ((select auth.uid()) = id)
with check ((select auth.uid()) = id);

-- No users INSERT policy for authenticated users:
-- profile creation is handled by auth trigger (security definer function).

-- subscriptions: users can read only their own subscription rows.
create policy subscriptions_select_own
on public.subscriptions
for select
to authenticated
using ((select auth.uid()) = user_id);

-- subscriptions: users can create subscription rows only for themselves.
-- WITH CHECK blocks forged user_id payloads.
create policy subscriptions_insert_own
on public.subscriptions
for insert
to authenticated
with check ((select auth.uid()) = user_id);

-- subscriptions: users can update only their own rows, and cannot reassign owner.
create policy subscriptions_update_own
on public.subscriptions
for update
to authenticated
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

-- subscriptions (optional): users can delete only their own rows.
create policy subscriptions_delete_own
on public.subscriptions
for delete
to authenticated
using ((select auth.uid()) = user_id);

-- payments: users may read only their own payment records.
-- No INSERT/UPDATE/DELETE policies are intentionally defined for authenticated users.
-- Backend service_role handles all payment writes.
create policy payments_select_own
on public.payments
for select
to authenticated
using ((select auth.uid()) = user_id);

-- logs: users may read only their own logs.
create policy logs_select_own
on public.logs
for select
to authenticated
using ((select auth.uid()) = user_id);

-- logs: users may insert logs only for themselves.
-- WITH CHECK blocks cross-tenant log injection.
create policy logs_insert_own
on public.logs
for insert
to authenticated
with check ((select auth.uid()) = user_id);

-- ============================================================================
-- 5) INDEXES (PERFORMANCE + TENANT-SCOPED ACCESS PATHS)
-- ============================================================================

create index if not exists subscriptions_user_id_idx
  on public.subscriptions (user_id);

create index if not exists payments_user_id_idx
  on public.payments (user_id);

create index if not exists logs_user_id_idx
  on public.logs (user_id);

-- Recommended support indexes for common production patterns.
create index if not exists logs_user_id_created_at_idx
  on public.logs (user_id, created_at desc);

create unique index if not exists payments_provider_external_id_uidx
  on public.payments (provider, external_id)
  where external_id is not null;
