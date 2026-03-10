-- ============================================================
-- Migration 032: Database-Backed Rate Limiting
-- Replaces in-memory Map<> with Postgres-backed rate limiter
-- ============================================================

-- 1. Rate limits table
CREATE TABLE IF NOT EXISTS rate_limits (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    identifier TEXT NOT NULL,         -- IP address or user ID
    endpoint TEXT NOT NULL,           -- e.g. 'claim_pin', 'contact_form', 'identify_mold'
    attempts INT NOT NULL DEFAULT 1,
    window_start TIMESTAMPTZ NOT NULL DEFAULT now(),
    UNIQUE(identifier, endpoint)
);

-- 2. Enable RLS (service role only — never queried from client)
ALTER TABLE rate_limits ENABLE ROW LEVEL SECURITY;

-- No public policies — only accessible via RPC with SECURITY DEFINER

-- 3. Rate limit check RPC
CREATE OR REPLACE FUNCTION check_rate_limit(
    p_identifier TEXT,
    p_endpoint TEXT,
    p_max_attempts INT,
    p_window_interval INTERVAL
) RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    v_record rate_limits%ROWTYPE;
BEGIN
    -- Try to find existing record
    SELECT * INTO v_record
    FROM rate_limits
    WHERE identifier = p_identifier AND endpoint = p_endpoint;

    IF NOT FOUND THEN
        -- First attempt in this window
        INSERT INTO rate_limits (identifier, endpoint, attempts, window_start)
        VALUES (p_identifier, p_endpoint, 1, now());
        RETURN TRUE;
    END IF;

    -- Check if window has expired
    IF v_record.window_start + p_window_interval < now() THEN
        -- Reset the window
        UPDATE rate_limits
        SET attempts = 1, window_start = now()
        WHERE id = v_record.id;
        RETURN TRUE;
    END IF;

    -- Window is active — check if under limit
    IF v_record.attempts >= p_max_attempts THEN
        RETURN FALSE;  -- Rate limited!
    END IF;

    -- Increment attempts
    UPDATE rate_limits
    SET attempts = attempts + 1
    WHERE id = v_record.id;
    RETURN TRUE;
END;
$$;

-- 4. Cleanup job — purge expired windows (run periodically or via cron)
CREATE OR REPLACE FUNCTION cleanup_rate_limits()
RETURNS void
LANGUAGE sql
SECURITY DEFINER
AS $$
    DELETE FROM rate_limits WHERE window_start < now() - INTERVAL '24 hours';
$$;

-- 5. Index for fast lookups
CREATE INDEX IF NOT EXISTS idx_rate_limits_lookup
    ON rate_limits(identifier, endpoint);
