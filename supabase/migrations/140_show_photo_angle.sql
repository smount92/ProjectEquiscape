-- ══════════════════════════════════════════════════════════════
-- Migration 140: Show_Photo angle_profile enum member
-- ══════════════════════════════════════════════════════════════
-- The in-dialog show-photo upload (EnterClassDialog / entry-photo
-- action) files show photos under the neutral "Other" angle because
-- angle_profile had no member for them (see the note in
-- src/lib/shows/entryPhoto.ts — migrations were out of scope for
-- that batch). This adds the real member so show photos can be
-- FIRST-CLASS: filterable in galleries, labeled honestly in the
-- passport, and countable against the 5-per-horse cap without
-- overloading "Other".
--
-- A "show photo" is the presentation shot an entrant submits to an
-- online show class — whole horse in frame, typically a sharp side
-- profile against a class-appropriate background. It is judged AS
-- the entry in online mode (show_class_entries.photo_id).
--
-- NOTE FOR APPLY: ALTER TYPE ... ADD VALUE cannot run inside a
-- transaction block on older Postgres — run this file's statements
-- as-is in the Supabase SQL editor (same as migration 090).
--
-- AFTER APPLY (in order):
--   1. npm run gen-types  (Show_Photo appears in the angle_profile union)
--   2. Flip SHOW_PHOTO_ANGLE in src/lib/shows/entryPhoto.ts from
--      "Other" to "Show_Photo" (existing rows uploaded as "Other"
--      stay valid — the cap check in entry-photo.ts counts by
--      constant, so flip only after gen-types).
-- Additive + idempotent.
-- ══════════════════════════════════════════════════════════════

ALTER TYPE angle_profile ADD VALUE IF NOT EXISTS 'Show_Photo';

COMMENT ON TYPE angle_profile IS
  'Photo slot/angle for horse_images. Show_Photo (migration 140) is the presentation shot submitted to online show classes — uploaded from the entry dialog, capped at 5 per horse for every tier (src/lib/shows/entryPhoto.ts).';

-- ══════════════════════════════════════════════════════════════
-- ✅ Migration 140 Complete — angle_profile + 'Show_Photo'.
-- After apply: npm run gen-types, then flip SHOW_PHOTO_ANGLE.
-- ══════════════════════════════════════════════════════════════
