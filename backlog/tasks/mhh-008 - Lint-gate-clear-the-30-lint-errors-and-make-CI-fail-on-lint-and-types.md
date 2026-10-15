---
id: MHH-008
title: 'Lint gate: clear the 30 lint errors and make CI fail on lint and types'
status: Done
assignee: []
created_date: '2026-10-15 22:19'
updated_date: '2026-10-15 22:37'
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
- [x] #1 `npm run lint` reports 0 errors
- [x] #2 CI lint step fails the build on error
- [x] #3 CI runs `tsc --noEmit` for app code
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Fixed the real problems (random numbers during render in BlueBookProCharts, JSX inside try/catch in DashboardV2, a plain <a> to /feed, escaped quotes, prefer-const, stray any, unused disable directives) and gave each intended setState-in-effect a written reason. CI now fails on lint errors and runs an app-only type check (npm run typecheck, tsconfig.typecheck.json).
<!-- SECTION:FINAL_SUMMARY:END -->
