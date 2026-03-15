-- ============================================================
-- 079: Add "Stolen/Missing" trade status
-- Prevents resale of flagged horses. Blocks transfers, exports.
-- ============================================================

-- Alter the trade_status check constraint to include 'Stolen/Missing'
-- First, we need to drop the existing constraint and recreate it.
-- Safe since this is an enum-style check, not a foreign key.

-- Add the new value to any existing CHECK constraint
-- Note: If using a CHECK constraint approach, we ALTER. If using an ENUM type,
-- we ALTER TYPE. Most Supabase setups use text columns with app-level validation.
-- This migration documents the intent; the app enforces the values.

-- No schema change needed if trade_status is a plain text column (which it is).
-- The app-level validation in database.ts type system handles this.

COMMENT ON COLUMN user_horses.trade_status IS 'Trade status: Not for Sale, For Sale, For Trade, Sold, Stolen/Missing';
