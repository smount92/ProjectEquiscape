-- ══════════════════════════════════════════════════════════════
-- Migration 127: Watermark — custom text + on-by-default
-- ══════════════════════════════════════════════════════════════
-- Adds a per-user custom watermark string (falls back to the default
-- "© @alias — ModelHorseHub" when null/blank) and makes photo watermarking
-- opt-OUT: new users default on.
--
-- The UPDATE also flips EXISTING users to on. This changes their FUTURE
-- uploads only (existing photos are untouched) and they can opt out in
-- Settings. Remove the UPDATE line if you'd rather only new accounts
-- default on and leave everyone's current choice as-is.
-- ══════════════════════════════════════════════════════════════

ALTER TABLE users ADD COLUMN IF NOT EXISTS watermark_text TEXT;

ALTER TABLE users ALTER COLUMN watermark_photos SET DEFAULT true;

UPDATE users
SET watermark_photos = true
WHERE watermark_photos IS DISTINCT FROM true;

-- ══════════════════════════════════════════════════════════════
-- ✅ Migration 127 Complete — users.watermark_text; watermark_photos
-- defaults true. After apply: npm run gen-types.
-- ══════════════════════════════════════════════════════════════
