-- ============================================================================
-- SECURITY TESTS FOR MULTI-TENANT RLS
-- Run on a non-production database first.
-- Some tests are expected to fail; run each test block independently.
-- ============================================================================

-- Test identities
-- User A: 11111111-1111-1111-1111-111111111111
-- User B: 22222222-2222-2222-2222-222222222222

-- ----------------------------------------------------------------------------
-- Seed baseline data as backend role (service_role bypasses RLS by design).
-- ----------------------------------------------------------------------------
set role service_role;

insert into public.users (id, email)
values
  ('11111111-1111-1111-1111-111111111111', 'user-a@example.com'),
  ('22222222-2222-2222-2222-222222222222', 'user-b@example.com')
on conflict (id) do update
set email = excluded.email;

insert into public.subscriptions (id, user_id, status, plan)
values
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'active', 'pro'),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'active', 'starter');

insert into public.payments (id, user_id, amount, status, provider, external_id)
values
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 49.00, 'succeeded', 'stripe', 'pay_A_001'),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 19.00, 'succeeded', 'stripe', 'pay_B_001');

insert into public.logs (id, user_id, event, metadata)
values
  (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 'seed_a', '{"source":"seed"}'::jsonb),
  (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'seed_b', '{"source":"seed"}'::jsonb);

reset role;

-- ----------------------------------------------------------------------------
-- 1) User A cannot SELECT User B data
-- Expected: leaked_rows = 0
-- ----------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

select count(*) as leaked_rows
from public.subscriptions
where user_id = '22222222-2222-2222-2222-222222222222';

reset role;

-- ----------------------------------------------------------------------------
-- 2) User cannot INSERT with another user_id
-- Expected: error (RLS violation)
-- ----------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

insert into public.subscriptions (id, user_id, status, plan)
values (gen_random_uuid(), '22222222-2222-2222-2222-222222222222', 'active', 'pro');

reset role;

-- ----------------------------------------------------------------------------
-- 3) User cannot UPDATE another user's row
-- Expected: UPDATE 0 (no rows updated)
-- ----------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

update public.subscriptions
set plan = 'enterprise'
where user_id = '22222222-2222-2222-2222-222222222222';

reset role;

-- ----------------------------------------------------------------------------
-- 4) anon role cannot access protected tables
-- Expected: permission denied or zero visible rows depending on grants/policies
-- ----------------------------------------------------------------------------
set role anon;

select * from public.users;
select * from public.subscriptions;
select * from public.payments;
select * from public.logs;

reset role;

-- ----------------------------------------------------------------------------
-- 5) Payments cannot be inserted from client
-- Expected: permission denied or RLS violation
-- ----------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

insert into public.payments (id, user_id, amount, status, provider, external_id)
values (gen_random_uuid(), '11111111-1111-1111-1111-111111111111', 99.00, 'pending', 'stripe', 'pay_A_forbidden');

reset role;

-- ----------------------------------------------------------------------------
-- 6) Logs are tenant-isolated
-- Expected: leaked_log_rows = 0
-- ----------------------------------------------------------------------------
set role authenticated;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', true);

select count(*) as leaked_log_rows
from public.logs
where user_id = '22222222-2222-2222-2222-222222222222';

-- Expected: error (cannot insert log for user B)
insert into public.logs (id, user_id, event, metadata)
values (
  gen_random_uuid(),
  '22222222-2222-2222-2222-222222222222',
  'cross_tenant_attempt',
  '{"attack":"forged-user-id"}'::jsonb
);

reset role;
