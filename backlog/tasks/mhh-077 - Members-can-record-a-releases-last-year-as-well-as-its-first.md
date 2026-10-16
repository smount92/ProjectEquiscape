---
id: MHH-077
title: Members can record a release's last year as well as its first
status: To Do
assignee: []
created_date: '2026-10-16 21:25'
labels:
  - registry
  - member-reported
milestone: m-3
dependencies: []
priority: medium
type: enhancement
ordinal: 77000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
Only a first year can be filed. Add my release silently drops an end year (parseInt of 1995-1997 keeps 1995), and a start-only year shows as 1998- in the linker.

**Source**
A volunteer cataloguing Breyer Stablemates, 2026-10-15/16; causes verified by two read-only investigations.

**Notes**
parseYearRange in src/lib/catalog/corrections.ts; one yearRangeLabel for the reference page chip, the linker and cards.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 parseYearRange accepts 1995, 1995-1997, 1995–97, 1995 - 1997 and 1995 to 1997, and rejects end before start and years out of range
- [ ] #2 Fill in what you know and Add my release write release_year_start and release_year_end
- [ ] #3 The new-entry form has a Last year (if it ended) field and the approval stores it
- [ ] #4 Every year display uses one yearRangeLabel; a start-only year shows as 1998
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->
