-- ============================================
-- Migration: Secure Billing and Entitlements
-- Description:
--   - Add billing source-of-truth tables for Creem
--   - Add immutable webhook inbox + billing audit logs
--   - Add entitlement snapshots and premium derivation helpers
--   - Add atomic Creem subscription event apply function
--   - Enforce free-plan limits + premium reminder gating at DB layer
-- ============================================

-- ============================================
-- Billing Tables
-- ============================================

CREATE TABLE IF NOT EXISTS public.billing_customers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  provider TEXT NOT NULL DEFAULT 'creem' CHECK (provider = 'creem'),
  provider_customer_id TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.billing_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  provider TEXT NOT NULL DEFAULT 'creem' CHECK (provider = 'creem'),
  provider_subscription_id TEXT NOT NULL UNIQUE,
  provider_customer_id TEXT,
  plan_code TEXT,
  product_id TEXT,
  status TEXT NOT NULL,
  current_period_start TIMESTAMPTZ,
  current_period_end TIMESTAMPTZ,
  cancel_at_period_end BOOLEAN NOT NULL DEFAULT FALSE,
  canceled_at TIMESTAMPTZ,
  trial_end TIMESTAMPTZ,
  last_event_created_at TIMESTAMPTZ,
  last_event_id TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_user_id
  ON public.billing_subscriptions(user_id);

CREATE INDEX IF NOT EXISTS idx_billing_subscriptions_provider_customer_id
  ON public.billing_subscriptions(provider_customer_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_billing_subscriptions_one_active_per_user
  ON public.billing_subscriptions(user_id)
  WHERE status IN (
    'active',
    'trialing',
    'past_due',
    'unpaid',
    'subscription.active',
    'subscription.paid',
    'subscription.trialing',
    'subscription.scheduled_cancel',
    'subscription.past_due',
    'subscription.unpaid'
  );

CREATE TABLE IF NOT EXISTS public.billing_webhook_inbox (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  provider TEXT NOT NULL DEFAULT 'creem' CHECK (provider = 'creem'),
  provider_event_id TEXT NOT NULL UNIQUE,
  event_type TEXT NOT NULL,
  event_created_at TIMESTAMPTZ,
  signature_valid BOOLEAN NOT NULL DEFAULT FALSE,
  payload_sha256 TEXT NOT NULL,
  payload_json JSONB NOT NULL,
  headers_json JSONB,
  processing_status TEXT NOT NULL DEFAULT 'pending' CHECK (
    processing_status IN ('pending', 'processed', 'failed', 'ignored')
  ),
  processing_error TEXT,
  received_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  processed_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_billing_webhook_inbox_status_received
  ON public.billing_webhook_inbox(processing_status, received_at);

CREATE TABLE IF NOT EXISTS public.entitlement_snapshots (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  is_premium BOOLEAN NOT NULL DEFAULT FALSE,
  features_json JSONB NOT NULL DEFAULT '{}'::JSONB,
  reason TEXT,
  effective_from TIMESTAMPTZ,
  effective_to TIMESTAMPTZ,
  computed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  source_subscription_id UUID REFERENCES public.billing_subscriptions(id) ON DELETE SET NULL,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.billing_audit_logs (
  id BIGINT GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  actor_type TEXT NOT NULL,
  actor_id TEXT,
  action TEXT NOT NULL,
  request_id TEXT,
  provider_event_id TEXT,
  old_values JSONB,
  new_values JSONB,
  metadata JSONB NOT NULL DEFAULT '{}'::JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_billing_audit_logs_user_id_created_at
  ON public.billing_audit_logs(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_billing_audit_logs_provider_event_id
  ON public.billing_audit_logs(provider_event_id);

-- ============================================
-- RLS and Policies
-- ============================================

ALTER TABLE public.billing_customers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_subscriptions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_webhook_inbox ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.entitlement_snapshots ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.billing_audit_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users view own billing customer" ON public.billing_customers;
CREATE POLICY "Users view own billing customer" ON public.billing_customers
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users view own billing subscriptions" ON public.billing_subscriptions;
CREATE POLICY "Users view own billing subscriptions" ON public.billing_subscriptions
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users view own entitlement snapshots" ON public.entitlement_snapshots;
CREATE POLICY "Users view own entitlement snapshots" ON public.entitlement_snapshots
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

-- ============================================
-- Entitlement Helpers
-- ============================================

CREATE OR REPLACE FUNCTION public.is_user_premium(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE SQL
SECURITY DEFINER
SET search_path = public
AS $$
  WITH latest_subscription AS (
    SELECT
      status,
      current_period_end
    FROM public.billing_subscriptions
    WHERE user_id = p_user_id
    ORDER BY COALESCE(last_event_created_at, updated_at, created_at) DESC
    LIMIT 1
  )
  SELECT CASE
    WHEN NOT EXISTS (SELECT 1 FROM latest_subscription) THEN FALSE
    WHEN (SELECT status FROM latest_subscription) IN (
      'active',
      'trialing',
      'subscription.active',
      'subscription.paid',
      'subscription.trialing',
      'subscription.scheduled_cancel'
    ) THEN TRUE
    WHEN (SELECT status FROM latest_subscription) IN (
      'past_due',
      'unpaid',
      'subscription.past_due',
      'subscription.unpaid'
    ) THEN COALESCE((SELECT current_period_end FROM latest_subscription), NOW() + INTERVAL '1 hour') > NOW()
    WHEN (SELECT status FROM latest_subscription) IN (
      'canceled',
      'subscription.canceled'
    ) THEN COALESCE((SELECT current_period_end FROM latest_subscription), TIMESTAMPTZ 'epoch') > NOW()
    ELSE FALSE
  END;
$$;

REVOKE ALL ON FUNCTION public.is_user_premium(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_user_premium(UUID) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.recompute_entitlement_snapshot(
  p_user_id UUID,
  p_reason TEXT DEFAULT NULL,
  p_source_subscription_id UUID DEFAULT NULL
)
RETURNS public.entitlement_snapshots
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_premium BOOLEAN := public.is_user_premium(p_user_id);
  v_features JSONB;
  v_effective_to TIMESTAMPTZ;
  v_source_subscription_id UUID := p_source_subscription_id;
  v_snapshot public.entitlement_snapshots%ROWTYPE;
BEGIN
  SELECT id, current_period_end
  INTO v_source_subscription_id, v_effective_to
  FROM public.billing_subscriptions
  WHERE user_id = p_user_id
  ORDER BY COALESCE(last_event_created_at, updated_at, created_at) DESC
  LIMIT 1;

  v_features := CASE
    WHEN v_is_premium THEN jsonb_build_object(
      'emailReminders', TRUE,
      'csvExport', TRUE,
      'contractsLimit', NULL
    )
    ELSE jsonb_build_object(
      'emailReminders', FALSE,
      'csvExport', FALSE,
      'contractsLimit', 5
    )
  END;

  INSERT INTO public.entitlement_snapshots (
    user_id,
    is_premium,
    features_json,
    reason,
    effective_from,
    effective_to,
    computed_at,
    source_subscription_id,
    updated_at
  )
  VALUES (
    p_user_id,
    v_is_premium,
    v_features,
    COALESCE(p_reason, 'recomputed'),
    NOW(),
    CASE
      WHEN v_is_premium THEN v_effective_to
      ELSE NOW()
    END,
    NOW(),
    v_source_subscription_id,
    NOW()
  )
  ON CONFLICT (user_id)
  DO UPDATE SET
    is_premium = EXCLUDED.is_premium,
    features_json = EXCLUDED.features_json,
    reason = EXCLUDED.reason,
    effective_from = EXCLUDED.effective_from,
    effective_to = EXCLUDED.effective_to,
    computed_at = EXCLUDED.computed_at,
    source_subscription_id = EXCLUDED.source_subscription_id,
    updated_at = EXCLUDED.updated_at
  RETURNING * INTO v_snapshot;

  RETURN v_snapshot;
END;
$$;

REVOKE ALL ON FUNCTION public.recompute_entitlement_snapshot(UUID, TEXT, UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.recompute_entitlement_snapshot(UUID, TEXT, UUID) TO service_role;

-- ============================================
-- Atomic Subscription Event Apply
-- ============================================

CREATE OR REPLACE FUNCTION public.apply_creem_subscription_event(
  p_provider_event_id TEXT,
  p_event_type TEXT,
  p_event_created_at TIMESTAMPTZ,
  p_provider_customer_id TEXT,
  p_provider_subscription_id TEXT,
  p_user_id UUID,
  p_status TEXT,
  p_plan_code TEXT,
  p_product_id TEXT,
  p_current_period_start TIMESTAMPTZ,
  p_current_period_end TIMESTAMPTZ,
  p_cancel_at_period_end BOOLEAN,
  p_canceled_at TIMESTAMPTZ,
  p_trial_end TIMESTAMPTZ,
  p_payload JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id UUID := p_user_id;
  v_existing public.billing_subscriptions%ROWTYPE;
  v_updated public.billing_subscriptions%ROWTYPE;
  v_old_state JSONB;
BEGIN
  IF NULLIF(BTRIM(COALESCE(p_provider_event_id, '')), '') IS NULL THEN
    RETURN jsonb_build_object('applied', FALSE, 'reason', 'missing_event_id');
  END IF;

  IF v_user_id IS NULL AND p_provider_customer_id IS NOT NULL THEN
    SELECT user_id
    INTO v_user_id
    FROM public.billing_customers
    WHERE provider_customer_id = p_provider_customer_id
    LIMIT 1;
  END IF;

  IF v_user_id IS NOT NULL AND p_provider_customer_id IS NOT NULL THEN
    INSERT INTO public.billing_customers (
      user_id,
      provider,
      provider_customer_id,
      updated_at
    )
    VALUES (
      v_user_id,
      'creem',
      p_provider_customer_id,
      NOW()
    )
    ON CONFLICT (user_id)
    DO UPDATE SET
      provider_customer_id = EXCLUDED.provider_customer_id,
      updated_at = NOW();
  END IF;

  IF NULLIF(BTRIM(COALESCE(p_provider_subscription_id, '')), '') IS NULL THEN
    IF v_user_id IS NOT NULL THEN
      PERFORM public.recompute_entitlement_snapshot(v_user_id, 'webhook_without_subscription', NULL);
    END IF;

    INSERT INTO public.billing_audit_logs (
      user_id,
      actor_type,
      actor_id,
      action,
      provider_event_id,
      metadata
    ) VALUES (
      v_user_id,
      'webhook',
      'creem',
      'subscription_event_ignored_no_subscription_id',
      p_provider_event_id,
      jsonb_build_object('event_type', p_event_type)
    );

    RETURN jsonb_build_object('applied', FALSE, 'reason', 'missing_subscription_id', 'user_id', v_user_id);
  END IF;

  SELECT *
  INTO v_existing
  FROM public.billing_subscriptions
  WHERE provider_subscription_id = p_provider_subscription_id
  FOR UPDATE;

  v_old_state := to_jsonb(v_existing);

  IF v_existing.id IS NOT NULL
    AND p_event_created_at IS NULL
    AND v_existing.last_event_created_at IS NOT NULL THEN
    INSERT INTO public.billing_audit_logs (
      user_id,
      actor_type,
      actor_id,
      action,
      provider_event_id,
      old_values,
      metadata
    ) VALUES (
      COALESCE(v_user_id, v_existing.user_id),
      'webhook',
      'creem',
      'subscription_event_ignored_missing_event_timestamp',
      p_provider_event_id,
      v_old_state,
      jsonb_build_object('event_type', p_event_type)
    );

    RETURN jsonb_build_object('applied', FALSE, 'reason', 'missing_event_timestamp');
  END IF;

  IF v_existing.id IS NOT NULL
    AND p_event_created_at IS NOT NULL
    AND v_existing.last_event_created_at IS NOT NULL
    AND p_event_created_at < v_existing.last_event_created_at THEN

    INSERT INTO public.billing_audit_logs (
      user_id,
      actor_type,
      actor_id,
      action,
      provider_event_id,
      old_values,
      metadata
    ) VALUES (
      COALESCE(v_user_id, v_existing.user_id),
      'webhook',
      'creem',
      'subscription_event_ignored_stale',
      p_provider_event_id,
      v_old_state,
      jsonb_build_object(
        'event_type', p_event_type,
        'event_created_at', p_event_created_at,
        'last_event_created_at', v_existing.last_event_created_at
      )
    );

    RETURN jsonb_build_object('applied', FALSE, 'reason', 'stale_event', 'user_id', COALESCE(v_user_id, v_existing.user_id));
  END IF;

  IF v_existing.id IS NULL AND v_user_id IS NULL THEN
    INSERT INTO public.billing_audit_logs (
      user_id,
      actor_type,
      actor_id,
      action,
      provider_event_id,
      metadata
    ) VALUES (
      NULL,
      'webhook',
      'creem',
      'subscription_event_ignored_missing_user_mapping',
      p_provider_event_id,
      jsonb_build_object(
        'event_type', p_event_type,
        'provider_customer_id', p_provider_customer_id,
        'provider_subscription_id', p_provider_subscription_id
      )
    );

    RETURN jsonb_build_object('applied', FALSE, 'reason', 'missing_user_mapping');
  END IF;

  IF v_existing.id IS NULL THEN
    INSERT INTO public.billing_subscriptions (
      user_id,
      provider,
      provider_subscription_id,
      provider_customer_id,
      plan_code,
      product_id,
      status,
      current_period_start,
      current_period_end,
      cancel_at_period_end,
      canceled_at,
      trial_end,
      last_event_created_at,
      last_event_id,
      created_at,
      updated_at
    )
    VALUES (
      COALESCE(v_user_id, v_existing.user_id),
      'creem',
      p_provider_subscription_id,
      p_provider_customer_id,
      p_plan_code,
      p_product_id,
      COALESCE(NULLIF(BTRIM(COALESCE(p_status, '')), ''), p_event_type),
      p_current_period_start,
      p_current_period_end,
      COALESCE(p_cancel_at_period_end, FALSE),
      p_canceled_at,
      p_trial_end,
      COALESCE(p_event_created_at, NOW()),
      p_provider_event_id,
      NOW(),
      NOW()
    )
    RETURNING * INTO v_updated;
  ELSE
    UPDATE public.billing_subscriptions
    SET
      user_id = COALESCE(v_user_id, user_id),
      provider_customer_id = COALESCE(p_provider_customer_id, provider_customer_id),
      plan_code = COALESCE(p_plan_code, plan_code),
      product_id = COALESCE(p_product_id, product_id),
      status = COALESCE(NULLIF(BTRIM(COALESCE(p_status, '')), ''), p_event_type, status),
      current_period_start = COALESCE(p_current_period_start, current_period_start),
      current_period_end = COALESCE(p_current_period_end, current_period_end),
      cancel_at_period_end = COALESCE(p_cancel_at_period_end, cancel_at_period_end),
      canceled_at = COALESCE(p_canceled_at, canceled_at),
      trial_end = COALESCE(p_trial_end, trial_end),
      last_event_created_at = COALESCE(p_event_created_at, NOW()),
      last_event_id = p_provider_event_id,
      updated_at = NOW()
    WHERE id = v_existing.id
    RETURNING * INTO v_updated;
  END IF;

  IF v_updated.user_id IS NOT NULL THEN
    PERFORM public.recompute_entitlement_snapshot(v_updated.user_id, 'creem_webhook', v_updated.id);
  END IF;

  INSERT INTO public.billing_audit_logs (
    user_id,
    actor_type,
    actor_id,
    action,
    provider_event_id,
    old_values,
    new_values,
    metadata
  ) VALUES (
    v_updated.user_id,
    'webhook',
    'creem',
    'subscription_event_applied',
    p_provider_event_id,
    v_old_state,
    to_jsonb(v_updated),
    jsonb_build_object(
      'event_type', p_event_type,
      'event_created_at', p_event_created_at,
      'payload_keys', COALESCE((SELECT jsonb_agg(key) FROM jsonb_object_keys(COALESCE(p_payload, '{}'::JSONB)) AS key), '[]'::JSONB)
    )
  );

  RETURN jsonb_build_object(
    'applied', TRUE,
    'reason', 'ok',
    'user_id', v_updated.user_id,
    'subscription_id', v_updated.id
  );
END;
$$;

REVOKE ALL ON FUNCTION public.apply_creem_subscription_event(
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  TEXT,
  TEXT,
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  TIMESTAMPTZ,
  BOOLEAN,
  TIMESTAMPTZ,
  TIMESTAMPTZ,
  JSONB
) FROM PUBLIC;

GRANT EXECUTE ON FUNCTION public.apply_creem_subscription_event(
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  TEXT,
  TEXT,
  UUID,
  TEXT,
  TEXT,
  TEXT,
  TIMESTAMPTZ,
  TIMESTAMPTZ,
  BOOLEAN,
  TIMESTAMPTZ,
  TIMESTAMPTZ,
  JSONB
) TO service_role;

-- ============================================
-- Contract mutation functions (premium + free cap enforcement)
-- ============================================

CREATE OR REPLACE FUNCTION public.create_contract_with_relations(
  p_user_id UUID,
  p_name TEXT,
  p_vendor TEXT,
  p_type TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_value DECIMAL,
  p_currency TEXT,
  p_auto_renew BOOLEAN,
  p_renewal_terms TEXT,
  p_notes TEXT,
  p_tags TEXT[],
  p_vendor_contact TEXT,
  p_vendor_email TEXT,
  p_reminder_days INTEGER[],
  p_email_reminders BOOLEAN,
  p_notify_emails TEXT[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_contract_id UUID;
  v_user_id UUID := auth.uid();
  v_name TEXT := NULLIF(BTRIM(COALESCE(p_name, '')), '');
  v_vendor TEXT := NULLIF(BTRIM(COALESCE(p_vendor, '')), '');
  v_currency TEXT := COALESCE(NULLIF(BTRIM(COALESCE(p_currency, '')), ''), 'USD');
  v_renewal_terms TEXT := NULLIF(BTRIM(COALESCE(p_renewal_terms, '')), '');
  v_notes TEXT := NULLIF(BTRIM(COALESCE(p_notes, '')), '');
  v_vendor_contact TEXT := NULLIF(BTRIM(COALESCE(p_vendor_contact, '')), '');
  v_vendor_email TEXT := NULLIF(BTRIM(COALESCE(p_vendor_email, '')), '');
  v_email_reminders BOOLEAN := COALESCE(p_email_reminders, FALSE);
  v_is_premium BOOLEAN;
  v_contract_count INTEGER;
  v_tags TEXT[] := ARRAY(
    SELECT normalized_tag
    FROM (
      SELECT DISTINCT NULLIF(BTRIM(raw_tag), '') AS normalized_tag
      FROM unnest(COALESCE(p_tags, '{}'::TEXT[])) AS raw_tag
    ) normalized
    WHERE normalized_tag IS NOT NULL
    ORDER BY normalized_tag
  );
  v_notify_emails TEXT[] := ARRAY(
    SELECT normalized_email
    FROM (
      SELECT DISTINCT NULLIF(BTRIM(raw_email), '') AS normalized_email
      FROM unnest(COALESCE(p_notify_emails, '{}'::TEXT[])) AS raw_email
    ) normalized
    WHERE normalized_email IS NOT NULL
    ORDER BY normalized_email
  );
  v_reminder_days INTEGER[] := ARRAY(
    SELECT DISTINCT reminder_day
    FROM unnest(COALESCE(p_reminder_days, '{}'::INTEGER[])) AS reminder_day
    WHERE reminder_day BETWEEN 1 AND 365
    ORDER BY reminder_day
  );
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF p_user_id IS DISTINCT FROM v_user_id THEN
    RAISE EXCEPTION 'User mismatch';
  END IF;

  IF v_name IS NULL OR v_vendor IS NULL THEN
    RAISE EXCEPTION 'Contract name and vendor are required';
  END IF;

  IF p_start_date IS NULL OR p_end_date IS NULL THEN
    RAISE EXCEPTION 'Start date and end date are required';
  END IF;

  IF p_end_date <= p_start_date THEN
    RAISE EXCEPTION 'End date must be after start date';
  END IF;

  IF (v_vendor_contact IS NULL) <> (v_vendor_email IS NULL) THEN
    RAISE EXCEPTION 'Vendor contact and vendor email must both be provided together';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(v_user_id::TEXT, 0));

  v_is_premium := public.is_user_premium(v_user_id);

  IF NOT v_is_premium THEN
    SELECT COUNT(*)
    INTO v_contract_count
    FROM public.contracts
    WHERE user_id = v_user_id;

    IF v_contract_count >= 5 THEN
      RAISE EXCEPTION 'Free plan contract limit reached';
    END IF;

    IF v_email_reminders THEN
      RAISE EXCEPTION 'Email reminders require an active premium subscription';
    END IF;
  END IF;

  INSERT INTO public.contracts (
    user_id,
    name,
    vendor,
    type,
    start_date,
    end_date,
    value,
    currency,
    auto_renew,
    renewal_terms,
    notes,
    tags,
    email_reminders
  )
  VALUES (
    p_user_id,
    v_name,
    v_vendor,
    p_type,
    p_start_date,
    p_end_date,
    p_value,
    v_currency,
    COALESCE(p_auto_renew, FALSE),
    v_renewal_terms,
    v_notes,
    COALESCE(v_tags, '{}'::TEXT[]),
    v_email_reminders
  )
  RETURNING id INTO v_contract_id;

  IF v_vendor_contact IS NOT NULL THEN
    INSERT INTO public.vendor_contacts (
      contract_id,
      contact_name,
      email
    )
    VALUES (
      v_contract_id,
      v_vendor_contact,
      v_vendor_email
    );
  END IF;

  IF COALESCE(array_length(v_reminder_days, 1), 0) > 0 THEN
    INSERT INTO public.reminders (
      contract_id,
      days_before,
      notify_emails
    )
    SELECT
      v_contract_id,
      reminder_day,
      COALESCE(v_notify_emails, '{}'::TEXT[])
    FROM unnest(v_reminder_days) AS reminder_day;
  END IF;

  RETURN v_contract_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.update_contract_with_relations(
  p_contract_id UUID,
  p_name TEXT,
  p_vendor TEXT,
  p_type TEXT,
  p_start_date DATE,
  p_end_date DATE,
  p_value DECIMAL,
  p_currency TEXT,
  p_auto_renew BOOLEAN,
  p_renewal_terms TEXT,
  p_notes TEXT,
  p_tags TEXT[],
  p_vendor_contact TEXT,
  p_vendor_email TEXT,
  p_reminder_days INTEGER[],
  p_email_reminders BOOLEAN,
  p_notify_emails TEXT[]
)
RETURNS UUID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_contract_id UUID;
  v_user_id UUID := auth.uid();
  v_name TEXT := NULLIF(BTRIM(COALESCE(p_name, '')), '');
  v_vendor TEXT := NULLIF(BTRIM(COALESCE(p_vendor, '')), '');
  v_currency TEXT := COALESCE(NULLIF(BTRIM(COALESCE(p_currency, '')), ''), 'USD');
  v_renewal_terms TEXT := NULLIF(BTRIM(COALESCE(p_renewal_terms, '')), '');
  v_notes TEXT := NULLIF(BTRIM(COALESCE(p_notes, '')), '');
  v_vendor_contact TEXT := NULLIF(BTRIM(COALESCE(p_vendor_contact, '')), '');
  v_vendor_email TEXT := NULLIF(BTRIM(COALESCE(p_vendor_email, '')), '');
  v_email_reminders BOOLEAN := COALESCE(p_email_reminders, FALSE);
  v_is_premium BOOLEAN;
  v_tags TEXT[] := ARRAY(
    SELECT normalized_tag
    FROM (
      SELECT DISTINCT NULLIF(BTRIM(raw_tag), '') AS normalized_tag
      FROM unnest(COALESCE(p_tags, '{}'::TEXT[])) AS raw_tag
    ) normalized
    WHERE normalized_tag IS NOT NULL
    ORDER BY normalized_tag
  );
  v_notify_emails TEXT[] := ARRAY(
    SELECT normalized_email
    FROM (
      SELECT DISTINCT NULLIF(BTRIM(raw_email), '') AS normalized_email
      FROM unnest(COALESCE(p_notify_emails, '{}'::TEXT[])) AS raw_email
    ) normalized
    WHERE normalized_email IS NOT NULL
    ORDER BY normalized_email
  );
  v_reminder_days INTEGER[] := ARRAY(
    SELECT DISTINCT reminder_day
    FROM unnest(COALESCE(p_reminder_days, '{}'::INTEGER[])) AS reminder_day
    WHERE reminder_day BETWEEN 1 AND 365
    ORDER BY reminder_day
  );
BEGIN
  IF v_user_id IS NULL THEN
    RAISE EXCEPTION 'Authentication required';
  END IF;

  IF v_name IS NULL OR v_vendor IS NULL THEN
    RAISE EXCEPTION 'Contract name and vendor are required';
  END IF;

  IF p_start_date IS NULL OR p_end_date IS NULL THEN
    RAISE EXCEPTION 'Start date and end date are required';
  END IF;

  IF p_end_date <= p_start_date THEN
    RAISE EXCEPTION 'End date must be after start date';
  END IF;

  IF (v_vendor_contact IS NULL) <> (v_vendor_email IS NULL) THEN
    RAISE EXCEPTION 'Vendor contact and vendor email must both be provided together';
  END IF;

  v_is_premium := public.is_user_premium(v_user_id);

  IF NOT v_is_premium AND v_email_reminders THEN
    RAISE EXCEPTION 'Email reminders require an active premium subscription';
  END IF;

  UPDATE public.contracts
  SET
    name = v_name,
    vendor = v_vendor,
    type = p_type,
    start_date = p_start_date,
    end_date = p_end_date,
    value = p_value,
    currency = v_currency,
    auto_renew = COALESCE(p_auto_renew, FALSE),
    renewal_terms = v_renewal_terms,
    notes = v_notes,
    tags = COALESCE(v_tags, '{}'::TEXT[]),
    email_reminders = v_email_reminders,
    updated_at = NOW()
  WHERE id = p_contract_id
    AND user_id = v_user_id
  RETURNING id INTO v_contract_id;

  IF v_contract_id IS NULL THEN
    RAISE EXCEPTION 'Contract not found or access denied';
  END IF;

  DELETE FROM public.vendor_contacts
  WHERE contract_id = v_contract_id;

  IF v_vendor_contact IS NOT NULL THEN
    INSERT INTO public.vendor_contacts (
      contract_id,
      contact_name,
      email
    )
    VALUES (
      v_contract_id,
      v_vendor_contact,
      v_vendor_email
    );
  END IF;

  DELETE FROM public.reminders
  WHERE contract_id = v_contract_id;

  IF COALESCE(array_length(v_reminder_days, 1), 0) > 0 THEN
    INSERT INTO public.reminders (
      contract_id,
      days_before,
      notify_emails
    )
    SELECT
      v_contract_id,
      reminder_day,
      COALESCE(v_notify_emails, '{}'::TEXT[])
    FROM unnest(v_reminder_days) AS reminder_day;
  END IF;

  RETURN v_contract_id;
END;
$$;

-- ============================================
-- Premium filter in reminder processors (fail closed)
-- ============================================

CREATE OR REPLACE FUNCTION public.get_due_email_reminders(
  p_reference_time TIMESTAMPTZ DEFAULT NOW(),
  p_limit INTEGER DEFAULT 100
)
RETURNS TABLE (
  reminder_id UUID,
  contract_id UUID,
  user_id UUID,
  contract_name TEXT,
  vendor TEXT,
  end_date DATE,
  days_before INTEGER,
  notify_emails TEXT[],
  timezone TEXT
)
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT
    reminders.id AS reminder_id,
    contracts.id AS contract_id,
    contracts.user_id,
    contracts.name AS contract_name,
    contracts.vendor,
    contracts.end_date,
    reminders.days_before,
    COALESCE(reminders.notify_emails, '{}'::TEXT[]) AS notify_emails,
    COALESCE(profiles.timezone, 'UTC') AS timezone
  FROM public.reminders AS reminders
  INNER JOIN public.contracts AS contracts
    ON contracts.id = reminders.contract_id
  LEFT JOIN public.profiles AS profiles
    ON profiles.user_id = contracts.user_id
  LEFT JOIN public.entitlement_snapshots AS entitlements
    ON entitlements.user_id = contracts.user_id
  WHERE reminders.sent_at IS NULL
    AND contracts.email_reminders = TRUE
    AND COALESCE(profiles.email_notifications, TRUE) = TRUE
    AND COALESCE(entitlements.is_premium, FALSE) = TRUE
    AND (contracts.end_date - reminders.days_before) = (
      (p_reference_time AT TIME ZONE COALESCE(profiles.timezone, 'UTC'))::DATE
    )
  ORDER BY contracts.end_date ASC, reminders.days_before DESC, reminders.created_at ASC
  LIMIT GREATEST(COALESCE(p_limit, 100), 1);
$$;

CREATE OR REPLACE FUNCTION public.claim_due_email_reminders(
  p_reference_time TIMESTAMPTZ DEFAULT NOW(),
  p_limit INTEGER DEFAULT 100,
  p_claim_token TEXT DEFAULT NULL,
  p_claim_timeout_seconds INTEGER DEFAULT 900
)
RETURNS TABLE (
  reminder_id UUID,
  contract_id UUID,
  user_id UUID,
  contract_name TEXT,
  vendor TEXT,
  end_date DATE,
  days_before INTEGER,
  notify_emails TEXT[],
  timezone TEXT
)
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public
AS $$
DECLARE
  v_claim_token TEXT := NULLIF(BTRIM(COALESCE(p_claim_token, '')), '');
  v_claim_timeout_seconds INTEGER := GREATEST(COALESCE(p_claim_timeout_seconds, 900), 60);
BEGIN
  IF v_claim_token IS NULL THEN
    RAISE EXCEPTION 'Claim token is required';
  END IF;

  RETURN QUERY
  WITH due_reminders AS (
    SELECT reminders.id
    FROM public.reminders AS reminders
    INNER JOIN public.contracts AS contracts
      ON contracts.id = reminders.contract_id
    LEFT JOIN public.profiles AS profiles
      ON profiles.user_id = contracts.user_id
    LEFT JOIN public.entitlement_snapshots AS entitlements
      ON entitlements.user_id = contracts.user_id
    WHERE reminders.sent_at IS NULL
      AND (
        reminders.processing_claimed_at IS NULL
        OR reminders.processing_claimed_at <= (
          p_reference_time - make_interval(secs => v_claim_timeout_seconds)
        )
      )
      AND contracts.email_reminders = TRUE
      AND COALESCE(profiles.email_notifications, TRUE) = TRUE
      AND COALESCE(entitlements.is_premium, FALSE) = TRUE
      AND (contracts.end_date - reminders.days_before) = (
        (p_reference_time AT TIME ZONE COALESCE(profiles.timezone, 'UTC'))::DATE
      )
    ORDER BY contracts.end_date ASC, reminders.days_before DESC, reminders.created_at ASC
    FOR UPDATE OF reminders SKIP LOCKED
    LIMIT GREATEST(COALESCE(p_limit, 100), 1)
  ),
  claimed_reminders AS (
    UPDATE public.reminders AS reminders
    SET
      processing_claimed_at = p_reference_time,
      processing_claim_token = v_claim_token
    FROM due_reminders
    WHERE reminders.id = due_reminders.id
    RETURNING
      reminders.id,
      reminders.contract_id,
      reminders.days_before,
      COALESCE(reminders.notify_emails, '{}'::TEXT[]) AS notify_emails
  )
  SELECT
    claimed_reminders.id AS reminder_id,
    contracts.id AS contract_id,
    contracts.user_id,
    contracts.name AS contract_name,
    contracts.vendor,
    contracts.end_date,
    claimed_reminders.days_before,
    claimed_reminders.notify_emails,
    COALESCE(profiles.timezone, 'UTC') AS timezone
  FROM claimed_reminders
  INNER JOIN public.contracts AS contracts
    ON contracts.id = claimed_reminders.contract_id
  LEFT JOIN public.profiles AS profiles
    ON profiles.user_id = contracts.user_id
  ORDER BY contracts.end_date ASC, claimed_reminders.days_before DESC;
END;
$$;

-- Ensure existing users have an entitlement row (fail closed defaults)
INSERT INTO public.entitlement_snapshots (
  user_id,
  is_premium,
  features_json,
  reason,
  effective_from,
  effective_to,
  computed_at,
  updated_at
)
SELECT
  users.id,
  FALSE,
  jsonb_build_object(
    'emailReminders', FALSE,
    'csvExport', FALSE,
    'contractsLimit', 5
  ),
  'backfill_default',
  NOW(),
  NOW(),
  NOW(),
  NOW()
FROM auth.users AS users
ON CONFLICT (user_id) DO NOTHING;
