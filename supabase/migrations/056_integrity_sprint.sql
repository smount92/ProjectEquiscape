-- ============================================================
-- Migration 056: V16 Integrity Sprint
-- Fix batch import RPC + Blue Book data pipeline
-- ============================================================

-- ══════════════════════════════════════════════════════════════
-- TASK 1: FIX BATCH IMPORT RPC
-- The old RPC references dropped columns (reference_mold_id, etc.)
-- Replace with catalog_id + asset_category support
-- ══════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION batch_import_horses(
    p_user_id UUID,
    p_horses JSONB
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
    horse_record JSONB;
    new_horse_id UUID;
    imported_count INT := 0;
BEGIN
    IF auth.uid() IS DISTINCT FROM p_user_id THEN
        RAISE EXCEPTION 'Unauthorized: user mismatch';
    END IF;

    FOR horse_record IN SELECT * FROM jsonb_array_elements(p_horses)
    LOOP
        INSERT INTO user_horses (
            owner_id,
            custom_name,
            finish_type,
            condition_grade,
            catalog_id,
            asset_category,
            is_public,
            trade_status
        ) VALUES (
            p_user_id,
            horse_record->>'custom_name',
            CASE
                WHEN COALESCE(horse_record->>'asset_category', 'model') = 'model'
                THEN COALESCE(horse_record->>'finish_type', 'OF')::finish_type
                ELSE NULL
            END,
            CASE
                WHEN COALESCE(horse_record->>'asset_category', 'model') = 'model'
                THEN COALESCE(horse_record->>'condition_grade', 'Not Graded')
                ELSE NULL
            END,
            NULLIF(horse_record->>'catalog_id', '')::UUID,
            COALESCE(horse_record->>'asset_category', 'model'),
            false,
            'Not for Sale'
        )
        RETURNING id INTO new_horse_id;

        -- Insert into financial_vault if price data exists
        IF (horse_record->>'purchase_price') IS NOT NULL
           OR (horse_record->>'estimated_value') IS NOT NULL THEN
            INSERT INTO financial_vault (
                horse_id,
                purchase_price,
                estimated_current_value
            ) VALUES (
                new_horse_id,
                NULLIF(horse_record->>'purchase_price', '')::NUMERIC,
                NULLIF(horse_record->>'estimated_value', '')::NUMERIC
            );
        END IF;

        imported_count := imported_count + 1;
    END LOOP;

    RETURN jsonb_build_object('success', true, 'imported', imported_count);
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- TASK 2: FIX BLUE BOOK DATA PIPELINE
-- Add sale_price to RPC return values so transactions get price metadata
-- ══════════════════════════════════════════════════════════════

-- 2a. claim_transfer_atomic — add sale_price to return JSONB
CREATE OR REPLACE FUNCTION claim_transfer_atomic(p_code TEXT, p_claimant_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_transfer RECORD;
    v_horse RECORD;
    v_sender_alias TEXT;
    v_receiver_alias TEXT;
    v_thumb TEXT;
BEGIN
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
    VALUES (v_transfer.horse_id, p_claimant_id, v_receiver_alias, v_transfer.acquisition_type, v_transfer.sale_price, v_transfer.is_price_public, 'Claimed via transfer');

    -- Transfer ownership
    UPDATE user_horses SET owner_id = p_claimant_id, collection_id = NULL WHERE id = v_transfer.horse_id;

    -- Mark transfer as claimed
    UPDATE horse_transfers SET status = 'claimed', claimed_by = p_claimant_id, claimed_at = now() WHERE id = v_transfer.id;

    -- Clear financial vault
    UPDATE financial_vault SET purchase_price = NULL, estimated_current_value = NULL, insurance_notes = NULL, purchase_date = NULL
    WHERE horse_id = v_transfer.horse_id;

    RETURN jsonb_build_object(
        'success', true,
        'horse_id', v_transfer.horse_id,
        'horse_name', v_horse.custom_name,
        'sender_id', v_transfer.sender_id,
        'sender_alias', v_sender_alias,
        'receiver_alias', v_receiver_alias,
        'sale_price', v_transfer.sale_price
    );
END;
$$;

-- 2b. claim_parked_horse_atomic — add sale_price to return JSONB
CREATE OR REPLACE FUNCTION claim_parked_horse_atomic(p_pin TEXT, p_claimant_id UUID)
RETURNS JSONB LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
    v_transfer RECORD; v_horse RECORD; v_sender_alias TEXT; v_receiver_alias TEXT; v_thumb TEXT;
BEGIN
    SELECT * INTO v_transfer FROM horse_transfers WHERE claim_pin = upper(trim(p_pin)) AND status = 'pending' FOR UPDATE;
    IF NOT FOUND THEN RETURN jsonb_build_object('success', false, 'error', 'Invalid PIN.'); END IF;
    IF v_transfer.expires_at < now() THEN UPDATE horse_transfers SET status = 'expired' WHERE id = v_transfer.id; RETURN jsonb_build_object('success', false, 'error', 'Expired PIN.'); END IF;
    IF v_transfer.sender_id = p_claimant_id THEN RETURN jsonb_build_object('success', false, 'error', 'Cannot claim your own horse.'); END IF;

    SELECT * INTO v_horse FROM user_horses WHERE id = v_transfer.horse_id;
    SELECT alias_name INTO v_sender_alias FROM users WHERE id = v_transfer.sender_id;
    SELECT alias_name INTO v_receiver_alias FROM users WHERE id = p_claimant_id;
    SELECT image_url INTO v_thumb FROM horse_images WHERE horse_id = v_transfer.horse_id AND angle_profile = 'Primary_Thumbnail' LIMIT 1;

    UPDATE horse_ownership_history SET released_at = now(), horse_name = v_horse.custom_name, horse_thumbnail = v_thumb WHERE horse_id = v_transfer.horse_id AND owner_id = v_transfer.sender_id AND released_at IS NULL;
    INSERT INTO horse_ownership_history (horse_id, owner_id, owner_alias, acquisition_type, sale_price, is_price_public, notes) VALUES (v_transfer.horse_id, p_claimant_id, v_receiver_alias, v_transfer.acquisition_type, v_transfer.sale_price, v_transfer.is_price_public, 'Claimed via CoA PIN');

    UPDATE user_horses SET owner_id = p_claimant_id, collection_id = NULL, life_stage = 'completed' WHERE id = v_transfer.horse_id;
    UPDATE horse_transfers SET status = 'claimed', claimed_by = p_claimant_id, claimed_at = now() WHERE id = v_transfer.id;

    UPDATE financial_vault SET purchase_price = NULL, estimated_current_value = NULL, insurance_notes = NULL, purchase_date = NULL WHERE horse_id = v_transfer.horse_id;

    RETURN jsonb_build_object(
        'success', true,
        'horse_id', v_transfer.horse_id,
        'horse_name', v_horse.custom_name,
        'sender_id', v_transfer.sender_id,
        'sender_alias', v_sender_alias,
        'receiver_alias', v_receiver_alias,
        'sale_price', v_transfer.sale_price
    );
END;
$$;

-- ══════════════════════════════════════════════════════════════
-- VERIFICATION
-- ══════════════════════════════════════════════════════════════
-- Test batch import:
-- SELECT batch_import_horses(auth.uid(), '[{"custom_name":"Test","finish_type":"OF","condition_grade":"Mint","catalog_id":null,"asset_category":"model"}]'::jsonb);
--
-- Verify claim RPCs return sale_price:
-- The RETURN jsonb_build_object now includes 'sale_price', v_transfer.sale_price
