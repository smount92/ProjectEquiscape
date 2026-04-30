-- ============================================================
-- Migration 114: Fix scale for Indian Pony mold #175
-- Beta tester reported: Model #1231 (Breyer - Savanna Dial) is on
-- Indian Pony mold #175 which is Traditional scale, not Stablemate.
-- The mold row + all its child releases inherited the wrong scale.
-- ============================================================

-- Fix the mold record (Indian Pony)
UPDATE catalog_items
SET scale = 'Traditional (1:9)'
WHERE item_type = 'plastic_mold'
  AND title ILIKE '%Indian Pony%'
  AND scale = 'Stablemate (1:32)';

-- Fix all releases on that mold (they inherit scale from the mold)
UPDATE catalog_items
SET scale = 'Traditional (1:9)'
WHERE item_type = 'plastic_release'
  AND parent_id IN (
    SELECT id FROM catalog_items
    WHERE item_type = 'plastic_mold'
      AND title ILIKE '%Indian Pony%'
  )
  AND scale = 'Stablemate (1:32)';
