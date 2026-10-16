---
id: MHH-071
title: Curator badge text matches the real thresholds
status: To Do
assignee: []
created_date: '2026-10-16 00:44'
labels:
  - registry
milestone: m-1
dependencies: []
priority: low
type: bug
ordinal: 71000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
Badge descriptions from migration 091 say 10/50/200 approvals; the code uses 5/10/50 (src/lib/catalog/corrections.ts).

**Source**
Registry moderator design research (2026-10-15).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Badge text and thresholds agree
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->
