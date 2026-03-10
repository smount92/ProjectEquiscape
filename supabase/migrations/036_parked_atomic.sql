-- ============================================================
-- Migration 036: Atomic Parked Horse Claim
-- Prevents TOCTOU race conditions on concurrent PIN claims
-- ============================================================

CREATE OR REPLACE FUNCTION claim_parked_horse_atomic(p_pin TEXT, p_claimant_id UUID)
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
    WHERE claim_pin = upper(trim(p_pin)) AND status = 'pending'
    FOR UPDATE;

    IF NOT FOUND THEN
        RETURN jsonb_build_object('success', false, 'error', 'Invalid or already claimed PIN.');
    END IF;

    IF v_transfer.expires_at < now() THEN
        UPDATE horse_transfers SET status = 'expired' WHERE id = v_transfer.id;
        RETURN jsonb_build_object('success', false, 'error', 'This claim PIN has expired.');
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

    -- Close sender's ownership record with ghost snapshot
    UPDATE horse_ownership_history
    SET released_at = now(), horse_name = v_horse.custom_name, horse_thumbnail = v_thumb
    WHERE horse_id = v_transfer.horse_id AND owner_id = v_transfer.sender_id AND released_at IS NULL;

    -- Create receiver's ownership record
    INSERT INTO horse_ownership_history (horse_id, owner_id, owner_alias, acquisition_type, sale_price, is_price_public, notes)
    VALUES (v_transfer.horse_id, p_claimant_id, v_receiver_alias, v_transfer.acquisition_type,
            v_transfer.sale_price, v_transfer.is_price_public, 'Claimed via Certificate of Authenticity PIN');

    -- Transfer ownership (keep existing life_stage)
    UPDATE user_horses SET owner_id = p_claimant_id, collection_id = NULL WHERE id = v_transfer.horse_id;

    -- Mark transfer as claimed
    UPDATE horse_transfers SET status = 'claimed', claimed_by = p_claimant_id, claimed_at = now() WHERE id = v_transfer.id;

    -- Create timeline events
    INSERT INTO horse_timeline (horse_id, user_id, event_type, title, description, is_public) VALUES
    (v_transfer.horse_id, v_transfer.sender_id, 'transferred',
     'Sold off-platform to @' || v_receiver_alias,
     'Sold off-platform and claimed via Certificate of Authenticity.', true),
    (v_transfer.horse_id, p_claimant_id, 'acquired',
     'Claimed from @' || v_sender_alias,
     'Acquired off-platform via Certificate of Authenticity PIN.', true);

    -- Clear financial vault (private data doesn't transfer)
    UPDATE financial_vault SET purchase_price = NULL, estimated_current_value = NULL,
        insurance_notes = NULL, purchase_date = NULL
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
