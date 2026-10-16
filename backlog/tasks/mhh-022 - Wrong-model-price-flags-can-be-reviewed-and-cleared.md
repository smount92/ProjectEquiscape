---
id: MHH-022
title: Wrong-model price flags can be reviewed and cleared
status: Done
assignee: []
created_date: '2026-10-15 22:19'
updated_date: '2026-10-16 00:57'
labels:
  - registry
  - admin
milestone: m-2
dependencies: []
priority: medium
type: feature
ordinal: 22000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
A flag hides a model's price forever; there is no admin screen.

**Source**
Gap G4.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Admin › Catalog lists active flags
- [x] #2 Resolve restores the price signal
- [x] #3 The flagger is told the outcome
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Admin › Catalog › Hidden eBay prices lists every active wrong-model report (model, reporter, note). 'Show it again' resolves the report (price returns, model back on the sweep) and tells the reporter; a price that really was wrong stays listed and hidden. Tests: price-flags-restore.test.ts.
<!-- SECTION:FINAL_SUMMARY:END -->
