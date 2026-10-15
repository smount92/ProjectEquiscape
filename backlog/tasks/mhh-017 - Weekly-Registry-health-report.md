---
id: MHH-017
title: Weekly Registry health report
status: To Do
assignee: []
created_date: '2026-10-15 22:19'
labels:
  - platform
  - registry
milestone: m-0
dependencies: []
priority: low
type: feature
ordinal: 17000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
The Registry is the product; its health numbers should be watched, not checked by hand.

**Source**
Ruling Q2; scripts/catalog-delta/registry_health.mjs.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A scheduled job runs the health scan weekly and keeps the output
- [ ] #2 Numbers that rose since last week are flagged
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->
