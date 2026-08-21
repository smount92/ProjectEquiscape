-- ============================================================
-- 172: Commerce bug fixes (found by the commerce-plan audit)
--
-- 1. chk_trade_status (007) allows only three values, but the app
--    has written two more for years:
--      · 'Stolen/Missing' — migration 079 added the FEATURE but its
--        comment claimed "no schema change needed", never widening
--        the 007 CHECK. Flagging a horse stolen violates the
--        constraint.
--      · 'Pending Sale' — acceptOffer (transactions.ts) locks the
--        horse with this value; the write violates the CHECK and the
--        code never checked the error, so accepting an offer leaves
--        the horse listed and other buyers keep offering.
--
-- 2. respond_to_offer_atomic (099) writes updated_at = NOW() on
--    decline, but transactions has no updated_at column — EVERY
--    offer decline since 099 has errored at the seller.
-- ============================================================

-- ── 1. trade_status catches up with the application ──
ALTER TABLE user_horses DROP CONSTRAINT IF EXISTS chk_trade_status;
ALTER TABLE user_horses ADD CONSTRAINT chk_trade_status
  CHECK (trade_status IN (
    'Not for Sale',
    'For Sale',
    'Open to Offers',
    'Pending Sale',
    'Stolen/Missing'
  ));

COMMENT ON COLUMN user_horses.trade_status IS
  'Not for Sale | For Sale | Open to Offers | Pending Sale (offer accepted, awaiting Safe-Trade completion) | Stolen/Missing (transfers/exports blocked)';

-- ── 2. respond_to_offer_atomic: drop the phantom column write ──
CREATE OR REPLACE FUNCTION respond_to_offer_atomic(
    p_transaction_id UUID,
    p_seller_id UUID,
    p_action TEXT
) RETURNS JSON AS $$
DECLARE
    v_txn RECORD;
BEGIN
    SELECT * INTO v_txn FROM transactions
    WHERE id = p_transaction_id
    FOR UPDATE;

    IF NOT FOUND THEN
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
        -- 099 wrote updated_at = NOW() here; transactions has no such
        -- column, so declines raised at the seller since it shipped.
        UPDATE transactions SET status = 'cancelled'
        WHERE id = p_transaction_id;
    ELSE
        RETURN json_build_object('success', false, 'error', 'Invalid action');
    END IF;

    RETURN json_build_object('success', true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

REVOKE EXECUTE ON FUNCTION respond_to_offer_atomic(UUID, UUID, TEXT) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION respond_to_offer_atomic(UUID, UUID, TEXT) TO authenticated;
