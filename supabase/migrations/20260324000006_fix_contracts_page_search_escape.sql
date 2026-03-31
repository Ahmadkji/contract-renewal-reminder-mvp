-- ============================================
-- Migration: Fix contracts page search escape handling
-- Description:
--   - Correct ESCAPE usage for ILIKE search in get_contracts_page_payload
--   - Prevent invalid escape sequence errors on search queries
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
    -- Escape backslash first, then wildcard characters for ILIKE ... ESCAPE '\'
    v_search_pattern := '%' || REPLACE(REPLACE(REPLACE(v_search, E'\\', E'\\\\'), '%', E'\\%'), '_', E'\\_') || '%';
  END IF;

  IF v_count_mode = 'exact' THEN
    v_count_started_at := clock_timestamp();

    SELECT COUNT(*)
    INTO v_total_count
    FROM public.contracts AS c
    WHERE c.user_id = v_auth_user_id
      AND (
        v_search_pattern IS NULL
        OR c.name ILIKE v_search_pattern ESCAPE E'\\'
        OR c.vendor ILIKE v_search_pattern ESCAPE E'\\'
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
        OR c.name ILIKE v_search_pattern ESCAPE E'\\'
        OR c.vendor ILIKE v_search_pattern ESCAPE E'\\'
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
