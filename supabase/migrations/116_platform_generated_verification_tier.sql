-- ============================================================
-- Migration 116: Allow 'platform_generated' verification tier
-- ============================================================
-- The competition engine inserts show_records with
-- verification_tier = 'platform_generated' (saveExpertPlacings,
-- recordShowResults), but the CHECK constraint from migration 030
-- only allowed ('self_reported', 'host_verified', 'mhh_auto'),
-- so every such insert failed. Widen the constraint.

ALTER TABLE show_records
  DROP CONSTRAINT IF EXISTS show_records_verification_tier_check;

ALTER TABLE show_records
  ADD CONSTRAINT show_records_verification_tier_check
  CHECK (verification_tier IN (
    'self_reported', 'host_verified', 'mhh_auto', 'platform_generated'
  ));
