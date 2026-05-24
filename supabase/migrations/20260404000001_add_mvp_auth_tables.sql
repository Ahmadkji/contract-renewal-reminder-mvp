-- ============================================
-- Migration: MVP Auth Tables
-- Description:
--   - Add app-owned users for bcrypt-backed credentials
--   - Add rotating refresh-token session storage
--   - Add password reset token storage
--   - Keep access restricted to server-side service role usage
-- ============================================

CREATE TABLE IF NOT EXISTS public.app_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,
  full_name TEXT,
  password_hash TEXT NOT NULL,
  email_verified_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_users_email
  ON public.app_users(email);

CREATE TABLE IF NOT EXISTS public.user_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  hashed_refresh_token TEXT NOT NULL,
  token_family TEXT NOT NULL UNIQUE,
  device_info TEXT NOT NULL DEFAULT 'unknown',
  device_fingerprint TEXT NOT NULL,
  ip_address TEXT NOT NULL DEFAULT 'unknown',
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_user_sessions_user_id
  ON public.user_sessions(user_id);

CREATE INDEX IF NOT EXISTS idx_user_sessions_expires_at
  ON public.user_sessions(expires_at);

CREATE INDEX IF NOT EXISTS idx_user_sessions_last_used_at
  ON public.user_sessions(last_used_at DESC);

CREATE TABLE IF NOT EXISTS public.app_password_reset_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES public.app_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  expires_at TIMESTAMPTZ NOT NULL,
  consumed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_app_password_reset_tokens_user_id
  ON public.app_password_reset_tokens(user_id);

CREATE INDEX IF NOT EXISTS idx_app_password_reset_tokens_expires_at
  ON public.app_password_reset_tokens(expires_at);

ALTER TABLE public.app_users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.user_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.app_password_reset_tokens ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.app_users FROM PUBLIC;
REVOKE ALL ON public.user_sessions FROM PUBLIC;
REVOKE ALL ON public.app_password_reset_tokens FROM PUBLIC;

