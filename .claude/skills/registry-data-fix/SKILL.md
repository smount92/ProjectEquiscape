---
name: registry-data-fix
description: Use for any problem with Registry (catalog) data - wrong facts, duplicates, a release under the wrong mold, missing models, bad names or spellings, empty molds, orphan releases, broken reference pages - and for reviewing the suggestion queue. Measure, dry-run, guarded repair run by the owner, measure again.
---

# Fix Registry data

The Registry is the reason people come. Every change to it is reversible,
measured, and run by the owner.

## Hard rules

- **Agents never write to the production database.** No service-role scripts, no mass UPDATEs. Read with the public key; hand the owner SQL files to paste.
- **Never delete a row a horse or want list points at.** Merge: repoint every reference to the kept row, then delete the empty duplicate. Members must never have to re-link.
- **Every repair has a dry run** that changes nothing and shows exactly what the repair will do.
- **Every repair is expect-guarded**: it changes a row only if the row still holds the value we read. A re-run does nothing; a member's edit in between is not trampled.
- **Repairs run in one transaction** and end by listing what they changed.
- Facts may come from anywhere; sentences are our own (see Decisions, sourcing ethics).

## Steps

1. **Measure first**: `node scripts/catalog-delta/registry_health.mjs > before.txt`.
2. **Find the cause.** Ask whether the problem is the data, or a search/display bug that only looks like bad data (run `investigate-bug` if unsure). Then ask how it got in: an import, a member suggestion, an approval that applied the wrong thing, our own code. If our code put it there, fix the code first.
3. **Decide the rule, not the row.** "Releases at Stablemate scale belong under the Stablemate mold of the same name" fixes 800 rows; fixing one row leaves the next one broken. Rules that need judgement go to the owner as a numbered list with a recommendation each.
4. **Write two files** in `scripts/catalog-delta/`: `<name>_dryrun.sql` and `<name>.sql`. Follow `registry_repair_2026_10_15.sql`: temp tables, expect-guards, repoint before delete, final listing.
5. **Hand both to the owner.** Paths only, never typing into their SQL editor.
6. **Measure again** with the health scan. Compare with `before.txt`: the target numbers moved, nothing else did.
7. **Spot-check** the pages members use: the reference page, the mold page, a horse linked to a changed row. Pages are cached for up to an hour.

## Reviewing the suggestion queue (Admin › Catalog)

- **New entry**: does the mold already exist under another spelling or scale? Approval blocks exact duplicates, not near ones. File it under the right mold.
- **Correction**: does the new value fit our formats (`docs/STANDARDS.md`, Data formats)? Is it a fact or someone's opinion?
- **Duplicate report**: are they truly the same release (same number, colour, years)? Approving merges them and moves every horse.
- **Rejecting**: always leave a note. The member gets it in their bell.
- A wrong approval can be reverted from the suggestion page.

## When a member's horses are affected

Read their linked horses and list every one that points at a changed or questionable row. Tell the owner the count and the fix: "6 of her 40 horses were linked to the deleted duplicate; all 6 now point at the kept mold".
