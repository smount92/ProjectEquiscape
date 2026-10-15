---
id: MHH-048
title: Bulk trade-status change respects the active-sale lock
status: Done
assignee: []
created_date: '2026-10-15 22:19'
updated_date: '2026-10-15 22:43'
labels:
  - stable
milestone: m-0
dependencies: []
priority: medium
type: bug
ordinal: 48000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
bulkUpdateHorses can flip a horse to not-for-sale while a deal is active; the single-horse path refuses.

**Source**
Old Roadmap (audit 2026-10-11).

**Notes**
src/app/actions/horse.ts
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Bulk path uses the same guard
- [x] #2 Test covers a horse in an active deal
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
bulkUpdateHorses refuses trade-status and visibility changes when any selected horse is in an active sale (same statuses as the single-horse guard); folder moves still allowed. Test added.
<!-- SECTION:FINAL_SUMMARY:END -->
