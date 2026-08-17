-- ============================================================
-- 150 — UNLISTED VISIBILITY, FINALLY REAL (audit collection M1)
--
-- The three-state model, now consistent at every layer:
--   public   — in the Show Ring/browse/search AND link-viewable
--   unlisted — link-viewable by ANYONE with the URL, listed nowhere
--   private  — owner only
--
-- visibility is the authoritative column; the 109 trigger derives
-- is_public = (visibility = 'public'), so every discovery surface
-- (Show Ring grid, market, matchmaker, show entry) that gates on
-- is_public keeps excluding unlisted automatically.
--
-- What was broken: the SELECT policy (last set in 112) gated on
-- is_public — so a genuinely-unlisted horse 404'd for every
-- LOGGED-IN visitor with the link, while the anon passport RPC
-- (135) correctly allowed public+unlisted. This aligns RLS with
-- the RPC. (The app-side halves — create passing visibility
-- through, edit no longer sending is_public and re-flipping
-- unlisted to public — ship in the same commit.)
-- ============================================================

DROP POLICY IF EXISTS "user_horses_select" ON user_horses;
CREATE POLICY "user_horses_select"
  ON user_horses FOR SELECT
  TO authenticated, anon
  USING (
    (SELECT auth.uid()) = owner_id
    OR (visibility IN ('public', 'unlisted') AND deleted_at IS NULL)
  );

-- ============================================================
-- After applying: no gen-types needed (no table changes).
-- Verify: as a non-owner signed-in user, a visibility='unlisted'
-- horse's passport URL loads; it does NOT appear in the Show Ring.
-- ============================================================
