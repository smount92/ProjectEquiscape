-- ═══════════════════════════════════════
-- MIGRATION 101: Trusted Sellers Materialized View
-- "Community Trusted" algorithmic badge system
-- ═══════════════════════════════════════

-- Materialized View: mv_trusted_sellers
-- Criteria:
--   1. Account age > 60 days
--   2. 5+ completed transfers to DISTINCT recipients
--   3. Average review rating >= 4.8 (with at least 3 reviews)
-- Refreshed by the /api/cron/refresh-market daily cron job.

CREATE MATERIALIZED VIEW IF NOT EXISTS mv_trusted_sellers AS
SELECT
    u.id AS user_id,
    u.alias_name,
    u.created_at AS account_created,
    COUNT(DISTINCT ht.claimed_by) AS distinct_buyers,
    COALESCE(AVG(r.stars), 0) AS avg_rating,
    COUNT(DISTINCT r.id) AS review_count
FROM users u
-- Completed transfers where user was the sender
INNER JOIN horse_transfers ht
    ON ht.sender_id = u.id
    AND ht.status = 'completed'
    AND ht.claimed_by IS NOT NULL
-- Reviews where user was the target (seller being reviewed)
LEFT JOIN reviews r
    ON r.target_id = u.id
WHERE
    -- Account must be > 60 days old
    u.created_at < NOW() - INTERVAL '60 days'
    -- Exclude test accounts
    AND u.is_test_account IS NOT TRUE
GROUP BY u.id, u.alias_name, u.created_at
HAVING
    -- At least 5 distinct buyers
    COUNT(DISTINCT ht.claimed_by) >= 5
    -- At least 3 reviews with avg >= 4.8 stars
    AND COUNT(DISTINCT r.id) >= 3
    AND AVG(r.stars) >= 4.8
WITH DATA;

-- Unique index required for REFRESH MATERIALIZED VIEW CONCURRENTLY
CREATE UNIQUE INDEX IF NOT EXISTS idx_mv_trusted_sellers_user_id
    ON mv_trusted_sellers (user_id);

-- Grant read access
GRANT SELECT ON mv_trusted_sellers TO authenticated, anon;

-- Convenience function: check if a user is trusted (avoids direct view query)
CREATE OR REPLACE FUNCTION is_trusted_seller(p_user_id UUID)
RETURNS BOOLEAN AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM mv_trusted_sellers WHERE user_id = p_user_id
    );
END;
$$ LANGUAGE plpgsql STABLE SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION is_trusted_seller TO authenticated, anon;

-- RPC wrapper to refresh the materialized view (called by cron job)
CREATE OR REPLACE FUNCTION refresh_mv_trusted_sellers()
RETURNS VOID AS $$
BEGIN
    REFRESH MATERIALIZED VIEW CONCURRENTLY mv_trusted_sellers;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

