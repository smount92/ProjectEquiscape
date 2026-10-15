---
id: MHH-002
title: Gold curators' corrections pass the same format checks as Silver
status: Done
assignee: []
created_date: '2026-10-15 22:19'
updated_date: '2026-10-15 22:41'
labels:
  - registry
milestone: m-0
dependencies: []
priority: high
type: bug
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
Gold-rank corrections go live with no vocabulary or format validation; Silver must pass `silverAutoApprovable`.

**Source**
Ruling Q5.

**Notes**
src/app/actions/catalog-suggestions.ts around createSuggestion autoApprove.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A Gold correction with a malformed value files as pending instead of applying
- [x] #2 Well-formed Gold corrections still apply at once
- [x] #3 Test covers both
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
curatorAutoApprovable() in src/lib/catalog/corrections.ts is the one decision: Gold may change any field but every value passes Silver's checks plus identity rules (capitalized names, no trailing punctuation, canonical scale); item_type/parent_id never auto-apply. Also added normalizeFactValue(), applied to every correction and addition write, so new colours are capitalized, names tidied and years stored as numbers (stops new format drift at the source; MHH-003 repairs the old rows).
<!-- SECTION:FINAL_SUMMARY:END -->
