-- Migration 115: Add is_trade flag to financial_vault
-- Marks a horse as acquired via trade (no cash value)

ALTER TABLE financial_vault
  ADD COLUMN IF NOT EXISTS is_trade BOOLEAN NOT NULL DEFAULT FALSE;

COMMENT ON COLUMN financial_vault.is_trade IS 'True when the horse was acquired via trade with no cash exchanged.';
