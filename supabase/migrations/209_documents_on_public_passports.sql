-- 209: Documentation shows on the passport (2026-09-16).
--
-- horse_documents (148) were readable by non-owners ONLY through a
-- show entry that pointed at them. MHI's Summerween feedback
-- ("entries lack breed/sex and supporting links") made documentation
-- part of the entry flow; the owner then asked that a horse's papers
-- live on her passport too. A public horse's documents are public —
-- exactly the passport's own gate (150: public/unlisted, not
-- deleted). Owner CRUD (148) is unchanged; a private horse's
-- documents stay private; the entry-visibility policy (148) still
-- covers show staff on private horses.
--
-- Additive (a second SELECT policy ORs with the first). The app
-- degrades gracefully before this is pasted: anon readers simply see
-- only entry-attached documents on the passport.
CREATE POLICY "Documents visible on public horses"
  ON horse_documents FOR SELECT
  TO authenticated, anon
  USING (
    EXISTS (
      SELECT 1 FROM user_horses h
      WHERE h.id = horse_documents.horse_id
        AND h.visibility IN ('public', 'unlisted')
        AND h.deleted_at IS NULL
    )
  );

-- ✅ Migration 209 Complete — a public horse's documentation is public
