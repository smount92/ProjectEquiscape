-- ============================================================
-- Migration 034: Tombstone Account Deletion
-- Soft-delete pattern to preserve provenance
-- ============================================================

-- 1. Add status columns to users
ALTER TABLE public.users
    ADD COLUMN IF NOT EXISTS account_status VARCHAR(20) NOT NULL DEFAULT 'active',
    ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;

-- 2. Change foreign keys on provenance tables from CASCADE to SET NULL
ALTER TABLE horse_timeline
    DROP CONSTRAINT IF EXISTS horse_timeline_user_id_fkey,
    ADD CONSTRAINT horse_timeline_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE commissions
    DROP CONSTRAINT IF EXISTS commissions_artist_id_fkey,
    ADD CONSTRAINT commissions_artist_id_fkey
        FOREIGN KEY (artist_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE commissions
    DROP CONSTRAINT IF EXISTS commissions_client_id_fkey,
    ADD CONSTRAINT commissions_client_id_fkey
        FOREIGN KEY (client_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE commission_updates
    DROP CONSTRAINT IF EXISTS commission_updates_author_id_fkey,
    ADD CONSTRAINT commission_updates_author_id_fkey
        FOREIGN KEY (author_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE show_records
    DROP CONSTRAINT IF EXISTS show_records_user_id_fkey,
    ADD CONSTRAINT show_records_user_id_fkey
        FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE horse_ownership_history
    DROP CONSTRAINT IF EXISTS horse_ownership_history_owner_id_fkey,
    ADD CONSTRAINT horse_ownership_history_owner_id_fkey
        FOREIGN KEY (owner_id) REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE user_ratings
    DROP CONSTRAINT IF EXISTS user_ratings_reviewer_id_fkey,
    ADD CONSTRAINT user_ratings_reviewer_id_fkey
        FOREIGN KEY (reviewer_id) REFERENCES public.users(id) ON DELETE SET NULL;
ALTER TABLE user_ratings
    DROP CONSTRAINT IF EXISTS user_ratings_reviewed_id_fkey,
    ADD CONSTRAINT user_ratings_reviewed_id_fkey
        FOREIGN KEY (reviewed_id) REFERENCES public.users(id) ON DELETE SET NULL;

-- 3. Soft delete RPC
CREATE OR REPLACE FUNCTION soft_delete_account(target_uid UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    -- Verify the caller is the account owner
    IF (SELECT auth.uid()) != target_uid THEN
        RAISE EXCEPTION 'Unauthorized: can only delete your own account';
    END IF;

    -- Anonymize the user record
    UPDATE public.users SET
        account_status = 'deleted',
        deleted_at = now(),
        alias_name = '[Deleted Collector]',
        bio = NULL,
        avatar_url = NULL,
        notification_prefs = NULL
    WHERE id = target_uid;

    -- Transfer all owned horses to "orphaned" status
    UPDATE public.user_horses SET
        is_public = false,
        trade_status = 'Not for Sale',
        life_stage = 'orphaned'
    WHERE owner_id = target_uid;

    -- Close any pending transfers
    UPDATE horse_transfers SET
        status = 'cancelled'
    WHERE sender_id = target_uid AND status = 'pending';

    -- Cancel any open commissions
    UPDATE commissions SET
        status = 'cancelled'
    WHERE (artist_id = target_uid OR client_id = target_uid)
      AND status NOT IN ('completed', 'delivered', 'cancelled');

    -- Remove from all groups
    DELETE FROM group_memberships WHERE user_id = target_uid;
END;
$$;

-- 4. Index for filtering active users
CREATE INDEX IF NOT EXISTS idx_users_account_status
    ON public.users(account_status);
