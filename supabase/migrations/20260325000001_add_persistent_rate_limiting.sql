-- ============================================
-- Migration: Persistent distributed rate limiting
-- Description:
--   - Add durable counter table for fixed-window rate limits
--   - Add atomic consume RPC for server-side API limiting
--   - Add cleanup RPC for periodic stale-row pruning
-- ============================================

CREATE TABLE IF NOT EXISTS public.rate_limit_counters (
  limiter_key TEXT NOT NULL CHECK (char_length(limiter_key) BETWEEN 1 AND 256),
  bucket_start TIMESTAMPTZ NOT NULL,
  request_count INTEGER NOT NULL DEFAULT 0 CHECK (request_count >= 0),
  expires_at TIMESTAMPTZ NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (limiter_key, bucket_start)
);

CREATE INDEX IF NOT EXISTS idx_rate_limit_counters_expires_at
  ON public.rate_limit_counters(expires_at);

CREATE OR REPLACE FUNCTION public.consume_rate_limit(
  p_limiter_key TEXT,
  p_limit INTEGER,
  p_window_seconds INTEGER,
  p_reference_time TIMESTAMPTZ DEFAULT NOW()
)
RETURNS TABLE (
  allowed BOOLEAN,
  remaining INTEGER,
  retry_after_seconds INTEGER,
  current_count INTEGER,
  reset_at TIMESTAMPTZ
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key TEXT := NULLIF(BTRIM(COALESCE(p_limiter_key, '')), '');
  v_limit INTEGER := GREATEST(COALESCE(p_limit, 1), 1);
  v_window_seconds INTEGER := GREATEST(COALESCE(p_window_seconds, 1), 1);
  v_reference_time TIMESTAMPTZ := COALESCE(p_reference_time, NOW());
  v_bucket_epoch BIGINT;
  v_bucket_start TIMESTAMPTZ;
  v_reset_at TIMESTAMPTZ;
  v_current_count INTEGER;
BEGIN
  IF v_key IS NULL THEN
    RAISE EXCEPTION 'Rate limit key is required';
  END IF;

  IF char_length(v_key) > 256 THEN
    RAISE EXCEPTION 'Rate limit key is too long (max 256 chars)';
  END IF;

  v_bucket_epoch := FLOOR(EXTRACT(EPOCH FROM v_reference_time) / v_window_seconds)::BIGINT * v_window_seconds;
  v_bucket_start := to_timestamp(v_bucket_epoch);
  v_reset_at := v_bucket_start + make_interval(secs => v_window_seconds);

  INSERT INTO public.rate_limit_counters (
    limiter_key,
    bucket_start,
    request_count,
    expires_at,
    created_at,
    updated_at
  )
  VALUES (
    v_key,
    v_bucket_start,
    1,
    v_reset_at + interval '1 hour',
    v_reference_time,
    v_reference_time
  )
  ON CONFLICT (limiter_key, bucket_start)
  DO UPDATE
  SET
    request_count = public.rate_limit_counters.request_count + 1,
    expires_at = GREATEST(public.rate_limit_counters.expires_at, v_reset_at + interval '1 hour'),
    updated_at = v_reference_time
  RETURNING request_count
  INTO v_current_count;

  allowed := v_current_count <= v_limit;
  remaining := GREATEST(v_limit - v_current_count, 0);
  retry_after_seconds := CASE
    WHEN allowed THEN 0
    ELSE GREATEST(1, CEIL(EXTRACT(EPOCH FROM (v_reset_at - v_reference_time)))::INTEGER)
  END;
  current_count := v_current_count;
  reset_at := v_reset_at;
  RETURN NEXT;
END;
$$;

CREATE OR REPLACE FUNCTION public.cleanup_expired_rate_limit_counters(
  p_limit INTEGER DEFAULT 5000
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_limit INTEGER := GREATEST(COALESCE(p_limit, 5000), 1);
  v_deleted_count INTEGER := 0;
BEGIN
  WITH stale AS (
    SELECT limiter_key, bucket_start
    FROM public.rate_limit_counters
    WHERE expires_at < NOW()
    ORDER BY expires_at ASC
    LIMIT v_limit
  ),
  deleted AS (
    DELETE FROM public.rate_limit_counters counters
    USING stale
    WHERE counters.limiter_key = stale.limiter_key
      AND counters.bucket_start = stale.bucket_start
    RETURNING 1
  )
  SELECT COUNT(*) INTO v_deleted_count FROM deleted;

  RETURN v_deleted_count;
END;
$$;

REVOKE ALL ON TABLE public.rate_limit_counters FROM PUBLIC;
REVOKE ALL ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTEGER, TIMESTAMPTZ) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.cleanup_expired_rate_limit_counters(INTEGER) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.consume_rate_limit(TEXT, INTEGER, INTEGER, TIMESTAMPTZ)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.cleanup_expired_rate_limit_counters(INTEGER)
  TO service_role;
