---
id: MHH-045
title: Move the last 40 model numbers out of titles
status: To Do
assignee: []
created_date: '2026-10-15 22:19'
labels:
  - registry
  - data
milestone: m-1
dependencies: []
priority: low
type: chore
ordinal: 45000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
40 titles still start with a model number.

**Source**
scripts/catalog-delta/repair_number_in_title.sql (dry run first).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Owner runs dry run then repair
- [ ] #2 Health scan shows 0
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->
