-- ============================================================
-- Migration 025: Parked Export & CoA
-- ============================================================

-- 1. Extend life_stage to include 'parked'
DO $$
BEGIN
  ALTER TABLE user_horses DROP CONSTRAINT IF EXISTS user_horses_life_stage_check;

  ALTER TABLE user_horses ADD CONSTRAINT user_horses_life_stage_check
    CHECK (life_stage IS NULL OR life_stage IN ('blank', 'in_progress', 'completed', 'for_sale', 'parked'));
END $$;

-- 2. Add claim_pin to horse_transfers
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'horse_transfers' AND column_name = 'claim_pin'
  ) THEN
    ALTER TABLE horse_transfers ADD COLUMN claim_pin VARCHAR(6) UNIQUE;
  END IF;
END $$;

-- 3. Index for fast PIN lookups
CREATE INDEX IF NOT EXISTS idx_horse_transfers_claim_pin
  ON horse_transfers (claim_pin) WHERE claim_pin IS NOT NULL;

-- 4. Extend event_type on horse_timeline to allow 'status_change' and 'condition_change'
DO $$
BEGIN
  ALTER TABLE horse_timeline DROP CONSTRAINT IF EXISTS horse_timeline_event_type_check;

  ALTER TABLE horse_timeline ADD CONSTRAINT horse_timeline_event_type_check
    CHECK (event_type IN (
      'acquired', 'stage_update', 'customization', 'photo_update',
      'show_result', 'listed', 'sold', 'transferred', 'note',
      'status_change', 'condition_change'
    ));
END $$;
