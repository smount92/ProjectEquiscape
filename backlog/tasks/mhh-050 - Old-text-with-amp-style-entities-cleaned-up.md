---
id: MHH-050
title: Old text with &amp;-style entities cleaned up
status: To Do
assignee: []
created_date: '2026-10-15 22:19'
labels:
  - data
milestone: m-1
dependencies: []
priority: low
type: chore
ordinal: 50000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
Rows written before 2026-10-08 were not backfilled; migration 227 was reserved and skipped.

**Source**
Old Roadmap.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Backfill SQL written with a dry run
- [ ] #2 Owner runs it
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->
