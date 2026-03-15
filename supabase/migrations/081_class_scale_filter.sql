-- ============================================================
-- 081: Add optional scale restriction to event_classes
-- Enforced at entry time — matches against catalog_items.scale
-- ============================================================

ALTER TABLE event_classes
    ADD COLUMN IF NOT EXISTS allowed_scales TEXT[];

-- Example: allowed_scales = ARRAY['Traditional', '1:9']
-- NULL means "any scale allowed" (backward compatible)

COMMENT ON COLUMN event_classes.allowed_scales IS
    'Array of allowed scale strings. NULL = no restriction. Matches catalog_items.scale.';
