-- ============================================================
-- Migration 071: QA Fixes Sprint
-- Fix 5 backend failures found during QA testing (2026-03-14)
-- ============================================================

-- ─── Fix 1: Del-03 — Account Deletion Blocked ───
-- soft_delete_account() sets life_stage = 'orphaned' but the
-- constraint only allows: blank, stripped, in_progress, completed,
-- for_sale, parked. Add 'orphaned' to the allowed list.
-- ============================================================

ALTER TABLE user_horses DROP CONSTRAINT IF EXISTS user_horses_life_stage_check;

ALTER TABLE user_horses ADD CONSTRAINT user_horses_life_stage_check
    CHECK (life_stage IS NULL OR life_stage IN (
        'blank', 'stripped', 'in_progress', 'completed',
        'for_sale', 'parked', 'orphaned'
    ));


-- ─── Fix 2: Mkt-02 — Blue Book Not Updating ───
-- completeTransaction() never writes sale_price into metadata.
-- The mv_market_prices materialized view reads metadata->>'sale_price'.
-- Add a trigger that copies offer_amount into metadata.sale_price
-- when status changes to 'completed'.
-- ============================================================

CREATE OR REPLACE FUNCTION trg_transaction_complete_price()
RETURNS TRIGGER AS $$
BEGIN
    IF NEW.status = 'completed' AND (OLD.status IS DISTINCT FROM 'completed') THEN
        NEW.completed_at = COALESCE(NEW.completed_at, now());
        NEW.metadata = COALESCE(NEW.metadata, '{}'::jsonb)
            || jsonb_build_object('sale_price', NEW.offer_amount);
    END IF;
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_transaction_complete_price ON transactions;
CREATE TRIGGER trg_transaction_complete_price
    BEFORE UPDATE ON transactions
    FOR EACH ROW
    EXECUTE FUNCTION trg_transaction_complete_price();


-- ─── Fix 3: Trn-04 — Expired PIN Auto-Revert ───
-- When a transfer PIN is expired and someone tries to claim it,
-- claim_parked_horse_atomic already sets status = 'expired'.
-- But the horse stays with life_stage = 'parked'. Add a revert:
-- On any expired PIN detection, reset the horse to the seller.
-- ============================================================

CREATE OR REPLACE FUNCTION auto_unpark_expired_transfers()
RETURNS void AS $$
BEGIN
    -- Find transfers that are pending but expired, revert the horse
    UPDATE user_horses h
    SET life_stage = 'completed'
    FROM horse_transfers t
    WHERE t.horse_id = h.id
      AND t.status = 'pending'
      AND t.expires_at < now()
      AND h.life_stage = 'parked';

    -- Mark those transfers as expired
    UPDATE horse_transfers
    SET status = 'expired'
    WHERE status = 'pending'
      AND expires_at < now();
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
