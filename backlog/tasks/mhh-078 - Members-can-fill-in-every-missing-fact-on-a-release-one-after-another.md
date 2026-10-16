---
id: MHH-078
title: 'Members can fill in every missing fact on a release, one after another'
status: To Do
assignee: []
created_date: '2026-10-16 21:25'
labels:
  - registry
  - member-reported
milestone: m-3
dependencies: []
priority: medium
type: bug
ordinal: 78000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
Fill in what you know opens only the first missing fact; after filing it the member cannot reach the next. Set pieces dead-end because their colour is blocked.

**Source**
A volunteer cataloguing Breyer Stablemates, 2026-10-15/16; causes verified by two read-only investigations.

**Notes**
ReferenceLinker.tsx ReleaseRow (setFilling(gaps[0])).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 One link per missing fact
- [ ] #2 A filed fact shows Sent for review and the others stay reachable
- [ ] #3 A set piece offers Add this piece's own row, opening Add my release prefilled
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->
