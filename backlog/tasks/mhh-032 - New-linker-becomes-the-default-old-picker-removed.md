---
id: MHH-032
title: New linker becomes the default; old picker removed
status: To Do
assignee: []
created_date: '2026-10-15 22:19'
updated_date: '2026-10-16 02:54'
due_date: '2026-10-29'
labels:
  - registry
milestone: m-1
dependencies: []
priority: medium
type: chore
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
Two weeks with no new linker bug, counted from 2026-10-15.

**Source**
Ruling Q7.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 No linker bug filed since 2026-10-15
- [ ] #2 New linker is the default
- [ ] #3 Old picker and the switch are deleted
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Built on branch linker-default (5e8cba98). Ships with the first release after 2026-10-29 if no linker bug is filed (ruling Q7).
<!-- SECTION:NOTES:END -->
