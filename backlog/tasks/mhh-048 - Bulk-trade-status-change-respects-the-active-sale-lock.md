---
id: MHH-048
title: Bulk trade-status change respects the active-sale lock
status: To Do
assignee: []
created_date: '2026-10-15 22:19'
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
- [ ] #1 Bulk path uses the same guard
- [ ] #2 Test covers a horse in an active deal
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->
