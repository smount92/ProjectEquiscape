---
id: MHH-011
title: A horse's history can never be cascade-deleted
status: To Do
assignee: []
created_date: '2026-10-15 22:19'
labels:
  - platform
  - data
milestone: m-0
dependencies: []
priority: medium
type: enhancement
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
27 foreign keys cascade from user_horses, including ownership history, transfers and show records. Soft delete protects them today; a hard delete would erase history.

**Source**
docs/STANDARDS.md plan step 4.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 History tables reference user_horses with RESTRICT
- [ ] #2 Soft delete and Recently Deleted still work (tests)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->
