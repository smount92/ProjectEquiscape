-- ============================================================
-- 080: Add relational FK references to horse_pedigrees
-- sire_id and dam_id point to actual user_horses records.
-- Free-text sire_name/dam_name remain as fallback for horses
-- not in the system (e.g., "GG Valentine" owned by another person).
-- ============================================================

ALTER TABLE horse_pedigrees
    ADD COLUMN IF NOT EXISTS sire_id UUID REFERENCES user_horses(id) ON DELETE SET NULL,
    ADD COLUMN IF NOT EXISTS dam_id UUID REFERENCES user_horses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_pedigree_sire ON horse_pedigrees(sire_id) WHERE sire_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_pedigree_dam ON horse_pedigrees(dam_id) WHERE dam_id IS NOT NULL;
