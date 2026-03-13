-- ============================================================
-- Migration 068: System Garbage Collection
-- Clean up read notifications and stale offers
-- ============================================================

CREATE OR REPLACE FUNCTION cleanup_system_garbage()
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    deleted_notifications INT;
    cancelled_offers INT;
BEGIN
    -- 1. Delete read notifications older than 30 days
    DELETE FROM notifications
    WHERE is_read = true AND created_at < NOW() - INTERVAL '30 days';
    GET DIAGNOSTICS deleted_notifications = ROW_COUNT;

    -- 2. Auto-cancel offer_made transactions older than 7 days
    UPDATE transactions
    SET status = 'cancelled', metadata = COALESCE(metadata, '{}'::jsonb) || '{"auto_cancelled": true}'::jsonb
    WHERE status = 'offer_made'
      AND created_at < NOW() - INTERVAL '7 days';
    GET DIAGNOSTICS cancelled_offers = ROW_COUNT;

    RETURN jsonb_build_object(
        'deleted_notifications', deleted_notifications,
        'cancelled_offers', cancelled_offers,
        'ran_at', now()
    );
END;
$$;
