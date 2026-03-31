-- ============================================
-- Migration: Concurrency hardening RPC and diagnostics
-- Description:
--   - Add single-round-trip contracts list RPC with timing metadata
--   - Add webhook ingest RPC for atomic dedupe/requeue
--   - Add advisory-lock helpers for reconcile route serialization
--   - Add runtime diagnostics RPC (connections/locks/backlogs)
-- ============================================

CREATE OR REPLACE FUNCTION public.get_contracts_page_payload(
  p_user_id UUID,
  p_page INTEGER DEFAULT 1,
  p_limit INTEGER DEFAULT 20,
  p_search TEXT DEFAULT NULL,
  p_upcoming BOOLEAN DEFAULT FALSE,
  p_count_mode TEXT DEFAULT 'planned'
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_auth_user_id UUID := auth.uid();
  v_page INTEGER := GREATEST(COALESCE(p_page, 1), 1);
  v_limit INTEGER := LEAST(GREATEST(COALESCE(p_limit, 20), 1), 5000);
  v_offset INTEGER := (v_page - 1) * v_limit;
  v_search TEXT := NULLIF(BTRIM(COALESCE(p_search, '')), '');
  v_search_pattern TEXT := NULL;
  v_count_mode TEXT := CASE
    WHEN LOWER(COALESCE(p_count_mode, 'planned')) = 'exact' THEN 'exact'
    ELSE 'planned'
  END;
  v_total_count BIGINT := 0;
  v_rows_json JSONB := '[]'::JSONB;
  v_slice_count INTEGER := 0;
  v_has_more BOOLEAN := FALSE;
  v_count_started_at TIMESTAMPTZ;
  v_list_started_at TIMESTAMPTZ;
  v_count_ms NUMERIC := 0;
  v_list_ms NUMERIC := 0;
BEGIN
  IF v_auth_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_user_id IS DISTINCT FROM v_auth_user_id THEN
    RAISE EXCEPTION 'User mismatch';
  END IF;

  IF v_search IS NOT NULL THEN
    v_search_pattern := '%' || REPLACE(REPLACE(v_search, '%', '\\%'), '_', '\\_') || '%';
  END IF;

  IF v_count_mode = 'exact' THEN
    v_count_started_at := clock_timestamp();

    SELECT COUNT(*)
    INTO v_total_count
    FROM public.contracts AS c
    WHERE c.user_id = v_auth_user_id
      AND (
        v_search_pattern IS NULL
        OR c.name ILIKE v_search_pattern ESCAPE '\\'
        OR c.vendor ILIKE v_search_pattern ESCAPE '\\'
      )
      AND (
        NOT COALESCE(p_upcoming, FALSE)
        OR (
          c.end_date >= CURRENT_DATE
          AND c.end_date <= (CURRENT_DATE + INTERVAL '60 days')
        )
      );

    v_count_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_count_started_at)) * 1000;
  END IF;

  v_list_started_at := clock_timestamp();

  WITH filtered AS (
    SELECT
      c.id,
      c.name,
      c.vendor,
      c.type,
      c.start_date,
      c.end_date,
      c.value,
      c.currency,
      c.auto_renew,
      c.tags,
      c.created_at,
      c.updated_at
    FROM public.contracts AS c
    WHERE c.user_id = v_auth_user_id
      AND (
        v_search_pattern IS NULL
        OR c.name ILIKE v_search_pattern ESCAPE '\\'
        OR c.vendor ILIKE v_search_pattern ESCAPE '\\'
      )
      AND (
        NOT COALESCE(p_upcoming, FALSE)
        OR (
          c.end_date >= CURRENT_DATE
          AND c.end_date <= (CURRENT_DATE + INTERVAL '60 days')
        )
      )
  ),
  page_slice AS (
    SELECT *
    FROM filtered
    ORDER BY end_date ASC, id ASC
    OFFSET v_offset
    LIMIT CASE
      WHEN v_count_mode = 'planned' THEN v_limit + 1
      ELSE v_limit
    END
  ),
  visible_rows AS (
    SELECT *
    FROM page_slice
    ORDER BY end_date ASC, id ASC
    LIMIT v_limit
  )
  SELECT
    COALESCE(
      jsonb_agg(
        to_jsonb(visible_rows)
        ORDER BY visible_rows.end_date ASC, visible_rows.id ASC
      ),
      '[]'::JSONB
    ),
    COALESCE((SELECT COUNT(*) FROM page_slice), 0)
  INTO v_rows_json, v_slice_count
  FROM visible_rows;

  v_list_ms := EXTRACT(EPOCH FROM (clock_timestamp() - v_list_started_at)) * 1000;

  IF v_count_mode = 'planned' THEN
    v_has_more := v_slice_count > v_limit;

    IF v_has_more THEN
      v_total_count := (v_page::BIGINT * v_limit::BIGINT) + 1;
    ELSE
      v_total_count := ((v_page::BIGINT - 1) * v_limit::BIGINT) + LEAST(v_slice_count, v_limit);
    END IF;
  END IF;

  RETURN jsonb_build_object(
    'contracts', v_rows_json,
    'total', GREATEST(v_total_count, 0),
    'countMode', v_count_mode,
    'timings', jsonb_build_object(
      'countMs', ROUND(v_count_ms, 2),
      'listMs', ROUND(v_list_ms, 2)
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.ingest_creem_webhook_event(
  p_provider_event_id TEXT,
  p_event_type TEXT,
  p_event_created_at TIMESTAMPTZ,
  p_payload_sha256 TEXT,
  p_payload_json JSONB,
  p_headers_json JSONB DEFAULT NULL,
  p_signature_valid BOOLEAN DEFAULT TRUE
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_now TIMESTAMPTZ := NOW();
  v_existing_status TEXT := NULL;
  v_event_type TEXT := COALESCE(NULLIF(BTRIM(COALESCE(p_event_type, '')), ''), 'unknown');
BEGIN
  IF NULLIF(BTRIM(COALESCE(p_provider_event_id, '')), '') IS NULL THEN
    RAISE EXCEPTION 'provider_event_id is required';
  END IF;

  IF NULLIF(BTRIM(COALESCE(p_payload_sha256, '')), '') IS NULL THEN
    RAISE EXCEPTION 'payload_sha256 is required';
  END IF;

  INSERT INTO public.billing_webhook_inbox (
    provider,
    provider_event_id,
    event_type,
    event_created_at,
    signature_valid,
    payload_sha256,
    payload_json,
    headers_json,
    processing_status,
    received_at,
    next_attempt_at,
    attempt_count,
    processing_claimed_at,
    processing_claim_token,
    processing_error
  )
  VALUES (
    'creem',
    p_provider_event_id,
    v_event_type,
    p_event_created_at,
    COALESCE(p_signature_valid, TRUE),
    p_payload_sha256,
    COALESCE(p_payload_json, '{}'::JSONB),
    p_headers_json,
    'pending',
    v_now,
    v_now,
    0,
    NULL,
    NULL,
    NULL
  );

  RETURN jsonb_build_object(
    'accepted', TRUE,
    'duplicate', FALSE,
    'requeued', FALSE,
    'status', 'pending'
  );
EXCEPTION
  WHEN unique_violation THEN
    UPDATE public.billing_webhook_inbox
    SET
      processing_status = 'pending',
      processing_error = NULL,
      next_attempt_at = v_now,
      processing_claimed_at = NULL,
      processing_claim_token = NULL
    WHERE provider_event_id = p_provider_event_id
      AND processing_status IN ('pending', 'failed')
    RETURNING processing_status
    INTO v_existing_status;

    IF FOUND THEN
      RETURN jsonb_build_object(
        'accepted', TRUE,
        'duplicate', TRUE,
        'requeued', TRUE,
        'status', 'pending'
      );
    END IF;

    SELECT processing_status
    INTO v_existing_status
    FROM public.billing_webhook_inbox
    WHERE provider_event_id = p_provider_event_id
    LIMIT 1;

    RETURN jsonb_build_object(
      'accepted', TRUE,
      'duplicate', TRUE,
      'requeued', FALSE,
      'status', COALESCE(v_existing_status, 'unknown')
    );
END;
$$;

CREATE OR REPLACE FUNCTION public.try_acquire_billing_reconcile_lock(
  p_lock_key BIGINT DEFAULT 843910732451001
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pg_try_advisory_lock(p_lock_key);
$$;

CREATE OR REPLACE FUNCTION public.release_billing_reconcile_lock(
  p_lock_key BIGINT DEFAULT 843910732451001
)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT pg_advisory_unlock(p_lock_key);
$$;

CREATE OR REPLACE FUNCTION public.get_runtime_concurrency_diagnostics(
  p_claim_timeout_seconds INTEGER DEFAULT 900
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_max_connections INTEGER := 0;
  v_active_connections INTEGER := 0;
  v_connection_usage_percent NUMERIC := 0;
  v_lock_wait_count INTEGER := 0;
  v_max_lock_wait_seconds NUMERIC := 0;
  v_webhook_pending INTEGER := 0;
  v_webhook_failed INTEGER := 0;
  v_reminder_stuck_claims INTEGER := 0;
  v_claim_timeout_seconds INTEGER := GREATEST(COALESCE(p_claim_timeout_seconds, 900), 60);
BEGIN
  SELECT COALESCE(setting::INTEGER, 0)
  INTO v_max_connections
  FROM pg_settings
  WHERE name = 'max_connections';

  SELECT COUNT(*)
  INTO v_active_connections
  FROM pg_stat_activity
  WHERE datname = current_database()
    AND pid <> pg_backend_pid();

  IF v_max_connections > 0 THEN
    v_connection_usage_percent := ROUND((v_active_connections::NUMERIC / v_max_connections::NUMERIC) * 100, 2);
  END IF;

  SELECT
    COUNT(*),
    COALESCE(MAX(EXTRACT(EPOCH FROM (clock_timestamp() - query_start))), 0)
  INTO v_lock_wait_count, v_max_lock_wait_seconds
  FROM pg_stat_activity
  WHERE datname = current_database()
    AND wait_event_type = 'Lock';

  SELECT COUNT(*)
  INTO v_webhook_pending
  FROM public.billing_webhook_inbox
  WHERE processing_status = 'pending';

  SELECT COUNT(*)
  INTO v_webhook_failed
  FROM public.billing_webhook_inbox
  WHERE processing_status = 'failed';

  SELECT COUNT(*)
  INTO v_reminder_stuck_claims
  FROM public.reminders
  WHERE sent_at IS NULL
    AND processing_claimed_at IS NOT NULL
    AND processing_claimed_at <= (NOW() - make_interval(secs => v_claim_timeout_seconds));

  RETURN jsonb_build_object(
    'capturedAt', NOW(),
    'connections', jsonb_build_object(
      'active', v_active_connections,
      'max', v_max_connections,
      'usagePercent', v_connection_usage_percent
    ),
    'locks', jsonb_build_object(
      'waitCount', v_lock_wait_count,
      'maxWaitSeconds', ROUND(v_max_lock_wait_seconds, 3)
    ),
    'webhooks', jsonb_build_object(
      'pending', v_webhook_pending,
      'failed', v_webhook_failed,
      'backlog', v_webhook_pending + v_webhook_failed
    ),
    'reminders', jsonb_build_object(
      'stuckClaims', v_reminder_stuck_claims
    )
  );
END;
$$;

REVOKE ALL ON FUNCTION public.get_contracts_page_payload(UUID, INTEGER, INTEGER, TEXT, BOOLEAN, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.ingest_creem_webhook_event(TEXT, TEXT, TIMESTAMPTZ, TEXT, JSONB, JSONB, BOOLEAN) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.try_acquire_billing_reconcile_lock(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.release_billing_reconcile_lock(BIGINT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_runtime_concurrency_diagnostics(INTEGER) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.get_contracts_page_payload(UUID, INTEGER, INTEGER, TEXT, BOOLEAN, TEXT)
  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.ingest_creem_webhook_event(TEXT, TEXT, TIMESTAMPTZ, TEXT, JSONB, JSONB, BOOLEAN)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.try_acquire_billing_reconcile_lock(BIGINT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.release_billing_reconcile_lock(BIGINT)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.get_runtime_concurrency_diagnostics(INTEGER)
  TO service_role;
