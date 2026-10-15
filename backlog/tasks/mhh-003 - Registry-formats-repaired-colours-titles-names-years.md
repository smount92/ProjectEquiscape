---
id: MHH-003
title: 'Registry formats repaired: colours, titles, names, years'
status: To Do
assignee: []
created_date: '2026-10-15 22:19'
updated_date: '2026-10-15 22:41'
labels:
  - registry
  - data
milestone: m-0
dependencies: []
priority: high
type: chore
ordinal: 3000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
Colour descriptions mix lowercase and capitals; 279 titles hold descriptions; 12 maker/artist names are one or two letters apart; 1,663 rows store years as text.

**Source**
Rulings Q23, Q24, Q25 (2026-10-15); docs/STANDARDS.md §3.

**Notes**
Dry run + expect-guarded repair the owner runs. Owner sees the 279 titles list before the repair. Merged makers keep old addresses working (depends on the forwarding ticket).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Colour descriptions start with a capital letter
- [ ] #2 Release titles hold the name; descriptions moved to notes
- [ ] #3 Each near-identical name pair merged to the more common spelling
- [ ] #4 Years are stored as numbers
- [ ] #5 Health scan before/after attached
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Write side done in MHH-002: normalizeFactValue() stops new drift. This ticket now only repairs existing rows.
<!-- SECTION:NOTES:END -->
