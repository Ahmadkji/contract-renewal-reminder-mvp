-- ============================================
-- Migration: Enable MVP Free Mode
-- Description:
--   - Force premium-equivalent entitlements for all users
--   - Keep billing schema/routes in place for future re-enable
--   - Backfill and auto-create entitlement snapshots for auth users
-- ============================================

CREATE OR REPLACE FUNCTION public.is_user_premium(p_user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT TRUE;
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
  v_snapshot public.entitlement_snapshots%ROWTYPE;
  v_features JSONB := jsonb_build_object(
    'emailReminders', TRUE,
    'csvExport', TRUE,
    'contractsLimit', NULL
  );
BEGIN
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
    TRUE,
    v_features,
    COALESCE(p_reason, 'mvp_free_mode'),
    NOW(),
    NULL,
    NOW(),
    p_source_subscription_id,
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

CREATE OR REPLACE FUNCTION public.sync_free_mode_entitlement_snapshot()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
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
    NEW.id,
    TRUE,
    jsonb_build_object(
      'emailReminders', TRUE,
      'csvExport', TRUE,
      'contractsLimit', NULL
    ),
    'auth_user_created_free_mode',
    NOW(),
    NULL,
    NOW(),
    NULL,
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
    updated_at = EXCLUDED.updated_at;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_auth_user_free_mode_entitlement_snapshot ON auth.users;
CREATE TRIGGER trg_auth_user_free_mode_entitlement_snapshot
AFTER INSERT ON auth.users
FOR EACH ROW
EXECUTE FUNCTION public.sync_free_mode_entitlement_snapshot();

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
SELECT
  users.id,
  TRUE,
  jsonb_build_object(
    'emailReminders', TRUE,
    'csvExport', TRUE,
    'contractsLimit', NULL
  ),
  'mvp_free_mode_backfill',
  NOW(),
  NULL,
  NOW(),
  NULL,
  NOW()
FROM auth.users AS users
ON CONFLICT (user_id)
DO UPDATE SET
  is_premium = EXCLUDED.is_premium,
  features_json = EXCLUDED.features_json,
  reason = EXCLUDED.reason,
  effective_from = EXCLUDED.effective_from,
  effective_to = EXCLUDED.effective_to,
  computed_at = EXCLUDED.computed_at,
  source_subscription_id = EXCLUDED.source_subscription_id,
  updated_at = EXCLUDED.updated_at;
