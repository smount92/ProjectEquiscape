---
id: MHH-066
title: Test files type-check cleanly
status: To Do
assignee: []
created_date: '2026-10-15 23:11'
labels:
  - platform
milestone: m-1
dependencies: []
priority: low
type: chore
ordinal: 66000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
377 type errors sit in test files (vitest runs them without type-checking). From Next 16.3 the build would refuse them, so the build and CI type-check app code only (tsconfig.typecheck.json).

**Source**
MHH-065 (Next 16.3.8 upgrade), 2026-10-15.

**Notes**
Most are untyped mock clients (mockClient._mockQuery.* is unknown). A typed mock helper would clear the bulk.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 tsc over the whole project reports 0 errors
- [ ] #2 CI type-checks test files too
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->
