-- ============================================================
-- Migration 074: Currency Preference
-- Adds per-user currency symbol for international collectors
-- ============================================================

ALTER TABLE users
  ADD COLUMN IF NOT EXISTS currency_symbol VARCHAR(5) DEFAULT '$';
COMMENT ON COLUMN users.currency_symbol IS 'Preferred currency symbol (e.g., $, £, €, ¥). Defaults to USD.';
