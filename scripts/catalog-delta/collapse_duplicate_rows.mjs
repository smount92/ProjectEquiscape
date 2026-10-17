#!/usr/bin/env node
/**
 * RETIRED (Release 3, 2026-10-16). This script no longer runs.
 *
 * It used to collapse byte-identical duplicate rows by DELETING the extra
 * rows after repointing four tables (horses, want lists, Help ID answers,
 * suggestions). That loses member data: every other table that points at
 * a Registry row went with the deleted row, among them members' sale
 * reports and price flags (cascade), releases filed under a duplicate mold,
 * changelog lines and old page addresses. And it could not be undone.
 * DECISIONS.md already lists the 159-row collapse as superseded by the
 * 2026-10-15 Registry repair.
 *
 * Duplicates are merged now, never deleted:
 *
 *   - On the site: the Registry Desk (/catalog/desk), Merge. A moderator's
 *     merge waits for a second look; the owner's applies at once. Either
 *     can be undone for 30 days from the Desk's History.
 *   - In the database: public.registry_merge(keep, remove, action, actor,
 *     reason) (migration 243), called only by src/lib/catalog/write.ts. It
 *     moves every link in one transaction (sale reports and price flags
 *     too), forwards the old address, and archives the duplicate whole so
 *     public.registry_unmerge can put it back.
 *
 * A bulk merge of many duplicates is Registry Desk Phase 2 (batches with a
 * second look). Until then, merge them on the Desk.
 *
 * The old code is in git history (before this commit) if it is ever needed
 * for reference. Do not restore it to run against the live Registry.
 */

const MESSAGE = `
collapse_duplicate_rows.mjs is retired and will not run.

It deleted duplicate Registry rows and lost members' sale reports and price
flags with them, and its deletes could not be undone.

Merge duplicates instead:
  * on the Registry Desk: /catalog/desk  ->  Merge (undoable for 30 days), or
  * through public.registry_merge (migration 243), which the Desk calls via
    src/lib/catalog/write.ts (requestMerge / confirmMerge).
`;

console.error(MESSAGE);
process.exit(1);
