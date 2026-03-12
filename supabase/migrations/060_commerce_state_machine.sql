-- ══════════════════════════════════════════════════════════════
-- Migration 060: Commerce State Machine
-- Expand transaction status to support offer/payment/verification flow
-- ══════════════════════════════════════════════════════════════

-- Drop and recreate the status CHECK constraint to add new states
ALTER TABLE transactions DROP CONSTRAINT IF EXISTS transactions_status_check;
ALTER TABLE transactions ADD CONSTRAINT transactions_status_check
    CHECK (status IN (
        'pending',          -- Legacy (existing system)
        'offer_made',       -- Buyer submitted offer
        'pending_payment',  -- Seller accepted, waiting for buyer to pay
        'funds_verified',   -- Seller confirmed funds, PIN generated
        'completed',        -- Transaction finalized
        'cancelled'         -- Either party cancelled
    ));

-- Add offer-specific metadata columns
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS offer_amount DECIMAL(10,2);
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS offer_message TEXT;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS paid_at TIMESTAMPTZ;
ALTER TABLE transactions ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;

-- Index for active offers (not completed/cancelled)
CREATE INDEX IF NOT EXISTS idx_transactions_active_offers
    ON transactions (horse_id, status)
    WHERE status IN ('offer_made', 'pending_payment', 'funds_verified');
