-- ============================================================
-- Migration 109: Fix is_public / visibility drift
-- The app writes to `visibility` (string: public/unlisted/private)
-- but RLS and some queries check `is_public` (boolean).
-- Bulk operations and quick-add only set one or the other,
-- causing them to drift apart.
--
-- Fix:
-- 1. Sync existing data: set is_public = (visibility = 'public')
-- 2. Add trigger to keep them in sync on every INSERT/UPDATE
-- 3. Update RLS policy to use visibility (authoritative column)
--
-- SAFETY ANALYSIS:
-- Step 1: Only writes to `is_public` (stale col), never changes `visibility`.
--         WHERE clause limits to out-of-sync rows only.
-- Step 2: CREATE OR REPLACE + DROP IF EXISTS are idempotent.
-- Step 3: DROP POLICY IF EXISTS + CREATE POLICY is safe (momentary gap).
-- ============================================================

-- Step 1: Sync existing data (visibility → is_public)
UPDATE user_horses
SET is_public = (visibility = 'public')
WHERE is_public != (visibility = 'public');

-- Step 2: Trigger to keep is_public in sync with visibility
CREATE OR REPLACE FUNCTION sync_is_public_from_visibility()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
    -- On INSERT: always sync is_public from visibility
    IF TG_OP = 'INSERT' THEN
        NEW.is_public := (NEW.visibility = 'public');
        RETURN NEW;
    END IF;

    -- On UPDATE: if visibility changed, sync is_public
    IF NEW.visibility IS DISTINCT FROM OLD.visibility THEN
        NEW.is_public := (NEW.visibility = 'public');
    END IF;
    -- If is_public changed (but visibility didn't), sync visibility
    IF NEW.is_public IS DISTINCT FROM OLD.is_public
       AND NEW.visibility IS NOT DISTINCT FROM OLD.visibility THEN
        NEW.visibility := CASE WHEN NEW.is_public THEN 'public' ELSE 'private' END;
    END IF;
    RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_visibility ON user_horses;
CREATE TRIGGER trg_sync_visibility
    BEFORE INSERT OR UPDATE ON user_horses
    FOR EACH ROW
    EXECUTE FUNCTION sync_is_public_from_visibility();

-- Step 3: Update RLS SELECT policy to use visibility
-- This replaces the policy from migration 022
DROP POLICY IF EXISTS "user_horses_select" ON user_horses;
CREATE POLICY "user_horses_select"
    ON user_horses FOR SELECT TO authenticated
    USING (
        (SELECT auth.uid()) = owner_id
        OR visibility = 'public'
    );
