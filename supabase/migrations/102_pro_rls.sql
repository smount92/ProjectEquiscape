-- ═══════════════════════════════════════
-- MIGRATION 102: Premium RLS & Photo Limits
-- Gates premium features at the Postgres level using JWT claims
-- ═══════════════════════════════════════

-- ── Helper: extract tier from JWT ──
CREATE OR REPLACE FUNCTION get_user_tier()
RETURNS TEXT AS $$
BEGIN
    RETURN COALESCE(
        current_setting('request.jwt.claims', true)::json->'app_metadata'->>'tier',
        'free'
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

-- ── RPC: count extra_detail photos for a horse ──
-- Used by the upload UI to enforce limits (10 free / 30 pro)
CREATE OR REPLACE FUNCTION get_extra_photo_count(p_horse_id UUID)
RETURNS INT AS $$
BEGIN
    RETURN (
        SELECT COUNT(*)::INT
        FROM horse_images
        WHERE horse_id = p_horse_id
          AND angle_profile = 'extra_detail'
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_extra_photo_count TO authenticated;

-- ── RPC: get photo upload limit based on tier ──
CREATE OR REPLACE FUNCTION get_photo_limit()
RETURNS INT AS $$
BEGIN
    IF get_user_tier() = 'pro' THEN
        RETURN 30;
    ELSE
        RETURN 10;
    END IF;
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION get_photo_limit TO authenticated;
