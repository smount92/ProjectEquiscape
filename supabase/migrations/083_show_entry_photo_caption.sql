-- 083: Add entry photo + caption to event_entries
-- Allows users to pick which photo to use and add a caption on show entries

ALTER TABLE event_entries
    ADD COLUMN IF NOT EXISTS entry_image_path TEXT,
    ADD COLUMN IF NOT EXISTS caption TEXT;

COMMENT ON COLUMN event_entries.entry_image_path IS 'Custom photo storage path for this entry. Falls back to horse primary thumbnail if null.';
COMMENT ON COLUMN event_entries.caption IS 'Short description or explanation of the entry (max 280 chars).';
