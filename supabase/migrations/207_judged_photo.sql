-- 207: The record keeps the photo it was judged on (2026-09-01).
--
-- Owner's ask: "the card should show the photo of the horse as it
-- was judged — in case the user uploads a new photo in the future."
-- Entries pin a photo_id, but that FK is ON DELETE SET NULL and
-- galleries change; a trophy-case row that borrows the horse's
-- CURRENT photo is quietly rewriting history. So the judged photo's
-- URL is frozen onto the record at publish, like everything else on
-- this table — records outlive galleries.
SET lock_timeout = '4s';

ALTER TABLE show_records
  ADD COLUMN IF NOT EXISTS entry_photo_url TEXT;

COMMENT ON COLUMN show_records.entry_photo_url IS
  'The entry photo AS JUDGED, frozen at results-publish. The horse''s gallery may change; this record does not.';

-- ✅ Migration 207 Complete — the judged photo rides the record
