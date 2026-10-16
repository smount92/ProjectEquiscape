---
id: MHH-003
title: 'Registry formats repaired: colours, titles, names, years'
status: Waiting on owner
assignee: []
created_date: '2026-10-15 22:19'
updated_date: '2026-10-16 00:26'
labels:
  - registry
  - data
milestone: m-1
dependencies: []
priority: high
type: chore
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
Colour descriptions mix lowercase and capitals; 279 titles hold descriptions; 12 maker/artist names are one or two letters apart; 1,663 rows store years as text.

**Source**
Rulings Q23, Q24, Q25 (2026-10-15); docs/STANDARDS.md §3.

**Notes**
Dry run + expect-guarded repair the owner runs. Owner sees the 279 titles list before the repair. Merged makers keep old addresses working (depends on the forwarding ticket).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Colour descriptions start with a capital letter
- [ ] #2 Release titles hold the name; descriptions moved to notes
- [ ] #3 Each near-identical name pair merged to the more common spelling
- [ ] #4 Years are stored as numbers
- [ ] #5 Health scan before/after attached
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Write side done in MHH-002: normalizeFactValue() stops new drift. This ticket now only repairs existing rows.

Ready 2026-10-15: review list scripts/catalog-delta/review/registry_format_review_2026_10.md (12 name merges, 271 titles: 59 split, 155 sets keep roster, 57 trimmed; 4,015 colours; 1,662 text years). Owner reviews, then runs registry_format_repair_2026_10_dryrun.sql and registry_format_repair_2026_10.sql, after migration 233 (so merged makers' old pages forward). Generator: gen_format_repair_2026_10.mjs. Abbreviation periods (I.C.E., Co., Jr.) are kept, here and in normalizeFactValue.

2026-10-15: owner named D'Arry Jones Frank, Sandra Winters and Maggie Bennett (= Maggie Jenner-Bennett); repair regenerated. Owner holding the Supabase run for now.
<!-- SECTION:NOTES:END -->
