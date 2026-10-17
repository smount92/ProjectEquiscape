---
id: MHH-093
title: Merging two Registry entries keeps members' sale reports and price flags
status: Done
assignee: []
created_date: '2026-10-16 23:31'
updated_date: '2026-10-16 23:36'
labels:
  - registry
milestone: m-3
dependencies: []
priority: high
type: bug
ordinal: 90000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why** The merge moved horses, want lists and suggestions but not catalog_sale_reports or catalog_price_signal_flags, which cascade-delete with the duplicate: member data lost on every merge. **Source** Found while writing docs/design/registry-desk-phase1-plan.md (migration 243 notes). **Notes** registry_merge (243) moves and saves them; the one-way merge used before 243 now moves them too (MERGE_REPOINTS in src/lib/catalog/write.ts), folding a member's second price flag on the same model.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 After a merge, sale reports and price flags filed on the duplicate are on the kept entry
- [x] #2 A member who flagged both entries keeps one flag, and the other is saved for an unmerge
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Tests pass (pre-commit)
- [x] #2 Decision recorded in docs/DECISIONS.md if one was made
- [x] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
registry_merge (243) moves and saves sale reports and price flags; the pre-243 one-way merge (MERGE_REPOINTS in write.ts) moves them too and folds a second flag.
<!-- SECTION:FINAL_SUMMARY:END -->
