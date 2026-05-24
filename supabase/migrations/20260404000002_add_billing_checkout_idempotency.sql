-- ============================================
-- Migration: Billing Checkout Idempotency
-- Description:
--   - Persist checkout idempotency keys across server instances
--   - Store the first trusted Creem checkout URL for safe replay
--   - Keep duplicate checkout attempts from creating extra sessions
-- ============================================

CREATE TABLE IF NOT EXISTS public.billing_checkout_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_code TEXT NOT NULL,
  request_id TEXT NOT NULL,
  dedupe_key TEXT NOT NULL UNIQUE,
  checkout_url TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'completed', 'failed')),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_checkout_sessions_user_id
  ON public.billing_checkout_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_billing_checkout_sessions_expires_at
  ON public.billing_checkout_sessions(expires_at);

ALTER TABLE public.billing_checkout_sessions ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.billing_checkout_sessions FROM PUBLIC;

