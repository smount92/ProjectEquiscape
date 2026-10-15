---
id: MHH-008
title: 'Lint gate: clear the 30 lint errors and make CI fail on lint and types'
status: To Do
assignee: []
created_date: '2026-10-15 22:19'
labels:
  - platform
milestone: m-0
dependencies: []
priority: high
type: chore
ordinal: 8000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
CI ran `next lint`, which Next 16 removed, so lint never ran. 30 errors and 73 warnings today; app code type-checks clean.

**Source**
docs/STANDARDS.md plan step 1; old Roadmap chore 'Clear the pre-existing lint errors'.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 `npm run lint` reports 0 errors
- [ ] #2 CI lint step fails the build on error
- [ ] #3 CI runs `tsc --noEmit` for app code
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->
