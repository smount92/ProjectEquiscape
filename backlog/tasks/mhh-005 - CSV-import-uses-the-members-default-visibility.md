---
id: MHH-005
title: CSV import uses the member's default visibility
status: To Do
assignee: []
created_date: '2026-10-15 22:19'
labels:
  - stable
milestone: m-0
dependencies: []
priority: medium
type: bug
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
Imported horses are always public; that default was an agent's choice, not the owner's.

**Source**
Ruling Q11.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Imported horses take the member's default visibility setting
- [ ] #2 Test covers public and private defaults
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->
