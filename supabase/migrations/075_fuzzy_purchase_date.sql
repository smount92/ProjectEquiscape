-- ============================================================
-- Migration 075: Fuzzy Purchase Date
-- Adds text-based approximate date for financial vault
-- ============================================================

ALTER TABLE financial_vault
  ADD COLUMN IF NOT EXISTS purchase_date_text TEXT;
COMMENT ON COLUMN financial_vault.purchase_date_text IS 'Approximate purchase date text (e.g., BreyerFest 2017, Summer 2015). Displayed when exact date is unavailable.';
