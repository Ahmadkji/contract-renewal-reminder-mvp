-- ============================================
-- Migration: Add Supabase Cron Scheduling For Reminder Processor
-- Description:
--   - Enable pg_cron and pg_net for Supabase-native scheduling
--   - Store scheduler configuration in a locked internal table
--   - Add helper functions to configure, invoke, schedule, and unschedule reminder processing
-- ============================================

CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS pg_net;

CREATE SCHEMA IF NOT EXISTS internal;

CREATE TABLE IF NOT EXISTS internal.runtime_config (
  config_key TEXT PRIMARY KEY,
  config_value TEXT NOT NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT timezone('utc', now())
);

REVOKE ALL ON SCHEMA internal FROM PUBLIC;
REVOKE ALL ON ALL TABLES IN SCHEMA internal FROM PUBLIC;

CREATE OR REPLACE FUNCTION public.set_contract_reminder_processor_config(
  p_app_base_url TEXT DEFAULT NULL,
  p_cron_secret TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, internal
AS $$
DECLARE
  v_app_base_url TEXT := NULLIF(btrim(COALESCE(p_app_base_url, '')), '');
  v_cron_secret TEXT := NULLIF(btrim(COALESCE(p_cron_secret, '')), '');
BEGIN
  IF v_app_base_url IS NULL AND v_cron_secret IS NULL THEN
    RAISE EXCEPTION 'At least one config value must be provided';
  END IF;

  IF v_app_base_url IS NOT NULL THEN
    IF v_app_base_url !~ '^https?://[^[:space:]]+$' THEN
      RAISE EXCEPTION 'Reminder processor app base URL must be a valid http(s) URL';
    END IF;

    INSERT INTO internal.runtime_config (config_key, config_value, updated_at)
    VALUES ('reminder_processor_app_base_url', v_app_base_url, timezone('utc', now()))
    ON CONFLICT (config_key) DO UPDATE
    SET
      config_value = EXCLUDED.config_value,
      updated_at = timezone('utc', now());
  END IF;

  IF v_cron_secret IS NOT NULL THEN
    INSERT INTO internal.runtime_config (config_key, config_value, updated_at)
    VALUES ('reminder_processor_cron_secret', v_cron_secret, timezone('utc', now()))
    ON CONFLICT (config_key) DO UPDATE
    SET
      config_value = EXCLUDED.config_value,
      updated_at = timezone('utc', now());
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION public.get_contract_reminder_processor_config_status()
RETURNS TABLE (
  app_base_url TEXT,
  has_cron_secret BOOLEAN
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, internal
AS $$
  SELECT
    (
      SELECT config_value
      FROM internal.runtime_config
      WHERE config_key = 'reminder_processor_app_base_url'
      LIMIT 1
    ) AS app_base_url,
    EXISTS (
      SELECT 1
      FROM internal.runtime_config
      WHERE config_key = 'reminder_processor_cron_secret'
    ) AS has_cron_secret;
$$;

CREATE OR REPLACE FUNCTION public.invoke_contract_reminder_processor(
  p_dry_run BOOLEAN DEFAULT FALSE,
  p_limit INTEGER DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, internal
AS $$
DECLARE
  v_app_base_url TEXT;
  v_cron_secret TEXT;
  v_request_body JSONB := jsonb_build_object(
    'dryRun',
    COALESCE(p_dry_run, FALSE),
    'source',
    'supabase-cron'
  );
  v_request_id BIGINT;
BEGIN
  SELECT config_value
  INTO v_app_base_url
  FROM internal.runtime_config
  WHERE config_key = 'reminder_processor_app_base_url'
  LIMIT 1;

  IF v_app_base_url IS NULL OR btrim(v_app_base_url) = '' THEN
    RAISE EXCEPTION 'Reminder processor app base URL is not configured';
  END IF;

  SELECT config_value
  INTO v_cron_secret
  FROM internal.runtime_config
  WHERE config_key = 'reminder_processor_cron_secret'
  LIMIT 1;

  IF v_cron_secret IS NULL OR btrim(v_cron_secret) = '' THEN
    RAISE EXCEPTION 'Reminder processor cron secret is not configured';
  END IF;

  IF p_limit IS NOT NULL THEN
    v_request_body := jsonb_set(
      v_request_body,
      '{limit}',
      to_jsonb(GREATEST(p_limit, 1)),
      TRUE
    );
  END IF;

  SELECT net.http_post(
    url := rtrim(v_app_base_url, '/') || '/api/internal/reminders/process',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || v_cron_secret
    ),
    body := v_request_body
  )
  INTO v_request_id;

  RETURN v_request_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.schedule_contract_reminder_processor(
  p_schedule TEXT DEFAULT '5 0 * * *',
  p_job_name TEXT DEFAULT 'contract-reminder-processor',
  p_dry_run BOOLEAN DEFAULT FALSE,
  p_limit INTEGER DEFAULT NULL
)
RETURNS BIGINT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_job_id BIGINT;
  v_job_id BIGINT;
  v_limit_sql TEXT := CASE
    WHEN p_limit IS NULL THEN 'NULL'
    ELSE GREATEST(p_limit, 1)::TEXT
  END;
BEGIN
  SELECT jobid
  INTO v_existing_job_id
  FROM cron.job
  WHERE jobname = p_job_name
  LIMIT 1;

  IF v_existing_job_id IS NOT NULL THEN
    PERFORM cron.unschedule(v_existing_job_id);
  END IF;

  SELECT cron.schedule(
    p_job_name,
    p_schedule,
    format(
      'select public.invoke_contract_reminder_processor(%s, %s);',
      CASE
        WHEN COALESCE(p_dry_run, FALSE) THEN 'true'
        ELSE 'false'
      END,
      v_limit_sql
    )
  )
  INTO v_job_id;

  RETURN v_job_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.unschedule_contract_reminder_processor(
  p_job_name TEXT DEFAULT 'contract-reminder-processor'
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_existing_job_id BIGINT;
BEGIN
  SELECT jobid
  INTO v_existing_job_id
  FROM cron.job
  WHERE jobname = p_job_name
  LIMIT 1;

  IF v_existing_job_id IS NULL THEN
    RETURN FALSE;
  END IF;

  PERFORM cron.unschedule(v_existing_job_id);
  RETURN TRUE;
END;
$$;

REVOKE ALL ON FUNCTION public.invoke_contract_reminder_processor(BOOLEAN, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.set_contract_reminder_processor_config(TEXT, TEXT) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_contract_reminder_processor_config_status() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.schedule_contract_reminder_processor(TEXT, TEXT, BOOLEAN, INTEGER) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.unschedule_contract_reminder_processor(TEXT) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.invoke_contract_reminder_processor(BOOLEAN, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.set_contract_reminder_processor_config(TEXT, TEXT) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_contract_reminder_processor_config_status() TO service_role;
GRANT EXECUTE ON FUNCTION public.schedule_contract_reminder_processor(TEXT, TEXT, BOOLEAN, INTEGER) TO service_role;
GRANT EXECUTE ON FUNCTION public.unschedule_contract_reminder_processor(TEXT) TO service_role;
