-- ============================================================
-- Migration 035: Atomic Mutations
-- Replaces sequential JS DB calls with transactional Postgres RPCs
-- ============================================================

-- ─── 1. Atomic Transfer Claim ────────────────────────────────
-- Fixes TOCTOU race condition in claimTransfer().
-- Uses FOR UPDATE row lock to prevent concurrent claims.
CREATE OR REPLACE FUNCTION claim_transfer_atomic(p_code TEXT, p_claimant_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_transfer RECORD;
    v_horse RECORD;
    v_sender_alias TEXT;
    v_receiver_alias TEXT;
    v_thumb TEXT;
BEGIN
    -- Lock the transfer row to prevent concurrent claims
    SELECT * INTO v_transfer FROM horse_transfers
    WHERE transfer_code = upper(trim(p_code)) AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or already claimed transfer code.');
    END IF;

    IF v_transfer.expires_at < now() THEN
        UPDATE horse_transfers SET status = 'expired' WHERE id = v_transfer.id;
        RETURN jsonb_build_object('success', false, 'error', 'This transfer code has expired.');
    END IF;

    IF v_transfer.sender_id = p_claimant_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'You cannot claim your own horse.');
    END IF;

    -- Gather context
    SELECT * INTO v_horse FROM user_horses WHERE id = v_transfer.horse_id;
    SELECT alias_name INTO v_sender_alias FROM users WHERE id = v_transfer.sender_id;
    SELECT alias_name INTO v_receiver_alias FROM users WHERE id = p_claimant_id;
    SELECT image_url INTO v_thumb FROM horse_images
        WHERE horse_id = v_transfer.horse_id AND angle_profile = 'Primary_Thumbnail' LIMIT 1;

    -- ── Execute all state changes atomically ──

    -- Close sender's ownership record with ghost snapshot
    UPDATE horse_ownership_history
    SET released_at = now(), horse_name = v_horse.custom_name, horse_thumbnail = v_thumb
    WHERE horse_id = v_transfer.horse_id AND owner_id = v_transfer.sender_id AND released_at IS NULL;

    -- Create receiver's ownership record
    INSERT INTO horse_ownership_history (horse_id, owner_id, owner_alias, acquisition_type, sale_price, is_price_public, notes)
    VALUES (v_transfer.horse_id, p_claimant_id, v_receiver_alias, v_transfer.acquisition_type, v_transfer.sale_price, v_transfer.is_price_public, 'Claimed via transfer');

    -- Transfer ownership (keep existing life_stage — don't override)
    UPDATE user_horses SET owner_id = p_claimant_id, collection_id = NULL WHERE id = v_transfer.horse_id;

    -- Mark transfer as claimed
    UPDATE horse_transfers SET status = 'claimed', claimed_by = p_claimant_id, claimed_at = now() WHERE id = v_transfer.id;

    -- Create timeline events
    INSERT INTO horse_timeline (horse_id, user_id, event_type, title, description, is_public) VALUES
    (v_transfer.horse_id, v_transfer.sender_id, 'transferred', 'Transferred to @' || v_receiver_alias, 'Ownership transferred.', true),
    (v_transfer.horse_id, p_claimant_id, 'acquired', 'Received from @' || v_sender_alias, 'Ownership acquired.', true);

    -- Clear financial vault (private data doesn't transfer)
    UPDATE financial_vault SET purchase_price = NULL, estimated_current_value = NULL, insurance_notes = NULL, purchase_date = NULL
    WHERE horse_id = v_transfer.horse_id;

    RETURN jsonb_build_object(
        'success', true,
        'horse_id', v_transfer.horse_id,
        'horse_name', v_horse.custom_name,
        'sender_id', v_transfer.sender_id,
        'sender_alias', v_sender_alias,
        'receiver_alias', v_receiver_alias
    );
END;
$$;


-- ─── 2. Server-Side Condition Change Tracker ─────────────────
-- Fixes "client dictates old condition" security hole.
-- Trigger fires AFTER UPDATE on user_horses.condition_grade,
-- reading OLD.condition_grade from the actual DB row.
CREATE OR REPLACE FUNCTION log_condition_change() RETURNS TRIGGER AS $$
BEGIN
    IF OLD.condition_grade IS DISTINCT FROM NEW.condition_grade THEN
        INSERT INTO condition_history (horse_id, changed_by, old_condition, new_condition)
        VALUES (NEW.id, NEW.owner_id, OLD.condition_grade, NEW.condition_grade);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trg_user_horses_condition ON user_horses;
CREATE TRIGGER trg_user_horses_condition
AFTER UPDATE OF condition_grade ON user_horses
FOR EACH ROW EXECUTE FUNCTION log_condition_change();


-- ─── 3. Atomic Vote Toggle ───────────────────────────────────
-- Fixes read-modify-write race condition in voteForEntry().
-- Single transaction: insert/delete vote + increment/decrement count.
CREATE OR REPLACE FUNCTION toggle_show_vote(p_entry_id UUID, p_user_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_new_votes INT;
    v_entry_owner UUID;
    v_action TEXT;
BEGIN
    -- Get entry owner (for self-vote check)
    SELECT user_id INTO v_entry_owner FROM show_entries WHERE id = p_entry_id;
    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Entry not found.');
    END IF;
    IF v_entry_owner = p_user_id THEN
        RETURN jsonb_build_object('success', false, 'error', 'Cannot vote for your own entry.');
    END IF;

    IF EXISTS(SELECT 1 FROM show_votes WHERE entry_id = p_entry_id AND user_id = p_user_id) THEN
        DELETE FROM show_votes WHERE entry_id = p_entry_id AND user_id = p_user_id;
        UPDATE show_entries SET votes = GREATEST(0, votes - 1) WHERE id = p_entry_id RETURNING votes INTO v_new_votes;
        v_action := 'unvoted';
    ELSE
        INSERT INTO show_votes (entry_id, user_id) VALUES (p_entry_id, p_user_id);
        UPDATE show_entries SET votes = votes + 1 WHERE id = p_entry_id RETURNING votes INTO v_new_votes;
        v_action := 'voted';
    END IF;

    RETURN jsonb_build_object('success', true, 'new_votes', v_new_votes, 'action', v_action, 'entry_owner', v_entry_owner);
END;
$$;


-- ─── 4. Scrub DMs on Account Deletion ────────────────────────
-- Updated soft_delete_account RPC with DM scrubbing
CREATE OR REPLACE FUNCTION soft_delete_account(target_uid UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
    IF (SELECT auth.uid()) != target_uid THEN
        RAISE EXCEPTION 'Unauthorized: can only delete your own account';
    END IF;

    UPDATE public.users SET
        account_status = 'deleted',
        deleted_at = now(),
        alias_name = '[Deleted Collector]',
        bio = NULL,
        avatar_url = NULL,
        notification_prefs = NULL
    WHERE id = target_uid;

    UPDATE public.user_horses SET
        is_public = false,
        trade_status = 'Not for Sale'
    WHERE owner_id = target_uid;

    -- Scrub private messages (privacy compliance)
    UPDATE public.messages SET content = '[Message deleted by user]' WHERE sender_id = target_uid;

    UPDATE horse_transfers SET status = 'cancelled'
    WHERE sender_id = target_uid AND status = 'pending';

    UPDATE commissions SET status = 'cancelled'
    WHERE (artist_id = target_uid OR client_id = target_uid)
      AND status NOT IN ('completed', 'delivered', 'cancelled');

    DELETE FROM group_memberships WHERE user_id = target_uid;
END;
$$;
