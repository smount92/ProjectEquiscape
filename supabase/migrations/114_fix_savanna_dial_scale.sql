-- ============================================================
-- Migration 114: Fix scale for Model #1231 Savanna Dial
-- Beta tester reported: Indian Pony mold #175 is Traditional scale,
-- not Stablemate. Correcting catalog_items.scale.
-- ============================================================

UPDATE catalog_items
SET scale = 'Traditional'
WHERE mold_number = '175'
  AND scale = 'Stablemate';
