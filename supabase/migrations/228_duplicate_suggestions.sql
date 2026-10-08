-- ============================================================
-- 228: "This is a duplicate" as a registry suggestion
--
-- A member who spots two registry entries for the same mold or
-- release (host report, 2026-10-03: "a couple of double molds for
-- foals") had no way to say so except a message to the owner. A
-- duplicate report is now a suggestion like any other: it carries
-- the entry it was filed from (catalog_item_id, the one to remove)
-- and the entry to keep (field_changes.duplicate_of). Approving it
-- runs the same merge the admin button runs — every reference is
-- repointed, the duplicate is deleted, the changelog records it.
--
-- Duplicates never auto-approve, whatever the reporter's rank.
-- ============================================================

ALTER TABLE catalog_suggestions
  DROP CONSTRAINT IF EXISTS catalog_suggestions_suggestion_type_check;
ALTER TABLE catalog_suggestions
  ADD CONSTRAINT catalog_suggestions_suggestion_type_check
  CHECK (suggestion_type IN ('correction', 'addition', 'removal', 'photo', 'duplicate'));

ALTER TABLE catalog_changelog
  DROP CONSTRAINT IF EXISTS catalog_changelog_change_type_check;
ALTER TABLE catalog_changelog
  ADD CONSTRAINT catalog_changelog_change_type_check
  CHECK (change_type IN ('correction', 'addition', 'removal', 'photo', 'duplicate'));
