-- ============================================================
-- Migration 069: Guest Client Portal
-- Allow artists to share commission timelines with non-MHH clients
-- ============================================================

ALTER TABLE commissions
    ADD COLUMN IF NOT EXISTS guest_token UUID DEFAULT gen_random_uuid();

CREATE UNIQUE INDEX IF NOT EXISTS idx_commissions_guest_token
    ON commissions (guest_token);
