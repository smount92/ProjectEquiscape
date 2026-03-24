-- ═══════════════════════════════════════
-- MIGRATION 099: Atomic Commerce RPCs
-- ═══════════════════════════════════════
-- Replaces Node.js state checks with Postgres row-locking RPCs
-- to prevent TOCTOU race conditions in the commerce engine.
-- NOTE: party_a_id = seller, party_b_id = buyer in marketplace_sale transactions.

-- RPC: make_offer_atomic
-- Locks the horse row, validates it's still available, then inserts the offer.
CREATE OR REPLACE FUNCTION make_offer_atomic(
    p_horse_id UUID,
    p_buyer_id UUID,
    p_seller_id UUID,
    p_offered_price NUMERIC,
    p_conversation_id UUID,
    p_message TEXT DEFAULT NULL,
    p_is_bundle BOOLEAN DEFAULT FALSE
) RETURNS JSON AS $$
DECLARE
    v_horse RECORD;
    v_existing_txn RECORD;
    v_new_txn RECORD;
    v_metadata JSON;
BEGIN
    -- Lock the horse row to prevent concurrent modifications
    SELECT * INTO v_horse
    FROM user_horses
    WHERE id = p_horse_id AND deleted_at IS NULL
    FOR UPDATE;

    IF v_horse IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Horse not found');
    END IF;

    IF v_horse.owner_id != p_seller_id THEN
        RETURN json_build_object('success', false, 'error', 'Seller does not own this horse');
    END IF;

    IF v_horse.trade_status NOT IN ('For Sale', 'Open to Offers') THEN
        RETURN json_build_object('success', false, 'error', 'Horse is not available for offers');
    END IF;

    -- Check for existing active transaction on this horse by this buyer
    SELECT * INTO v_existing_txn
    FROM transactions
    WHERE horse_id = p_horse_id
      AND party_b_id = p_buyer_id
      AND status NOT IN ('completed', 'cancelled', 'retracted')
    FOR UPDATE;

    IF v_existing_txn IS NOT NULL THEN
        RETURN json_build_object('success', false, 'error', 'You already have an active offer on this horse');
    END IF;

    -- Build metadata
    IF p_is_bundle THEN
        v_metadata := '{"is_bundle_sale": true}'::JSON;
    ELSE
        v_metadata := NULL;
    END IF;

    -- Insert the offer using actual column names
    INSERT INTO transactions (
        type, status, party_a_id, party_b_id, horse_id,
        conversation_id, offer_amount, offer_message, metadata
    )
    VALUES (
        'marketplace_sale', 'offer_made', p_seller_id, p_buyer_id, p_horse_id,
        p_conversation_id, p_offered_price, p_message, v_metadata
    )
    RETURNING * INTO v_new_txn;

    RETURN json_build_object('success', true, 'transaction_id', v_new_txn.id);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- RPC: respond_to_offer_atomic
-- Locks the transaction row, validates state, then applies accept/decline.
CREATE OR REPLACE FUNCTION respond_to_offer_atomic(
    p_transaction_id UUID,
    p_seller_id UUID,
    p_action TEXT  -- 'accept' or 'decline'
) RETURNS JSON AS $$
DECLARE
    v_txn RECORD;
BEGIN
    SELECT * INTO v_txn
    FROM transactions
    WHERE id = p_transaction_id
    FOR UPDATE;

    IF v_txn IS NULL THEN
        RETURN json_build_object('success', false, 'error', 'Transaction not found');
    END IF;

    IF v_txn.party_a_id != p_seller_id THEN
        RETURN json_build_object('success', false, 'error', 'Not authorized');
    END IF;

    IF v_txn.status != 'offer_made' THEN
        RETURN json_build_object('success', false, 'error', 'Transaction is no longer in offer_made state');
    END IF;

    IF p_action = 'accept' THEN
        UPDATE transactions SET status = 'pending_payment', accepted_at = NOW()
        WHERE id = p_transaction_id;
    ELSIF p_action = 'decline' THEN
        UPDATE transactions SET status = 'cancelled', updated_at = NOW()
        WHERE id = p_transaction_id;
    ELSE
        RETURN json_build_object('success', false, 'error', 'Invalid action');
    END IF;

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION make_offer_atomic TO authenticated;
GRANT EXECUTE ON FUNCTION respond_to_offer_atomic TO authenticated;
