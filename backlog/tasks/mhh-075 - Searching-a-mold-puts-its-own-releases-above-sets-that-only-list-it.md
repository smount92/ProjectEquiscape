---
id: MHH-075
title: Searching a mold puts its own releases above sets that only list it
status: To Do
assignee: []
created_date: '2026-10-16 21:25'
labels:
  - registry
  - member-reported
milestone: m-3
dependencies: []
priority: high
type: bug
ordinal: 75000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
Searching Arabian Stallion returns 49 Stablemate rows and only 8 are on that mold; a set's roster pulls in every piece it names.

**Source**
A volunteer cataloguing Breyer Stablemates, 2026-10-15/16; causes verified by two read-only investigations.

**Notes**
getCatalogItems in src/app/actions/catalog-suggestions.ts and the linker search.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A row whose own mold or own name (before With) matches ranks above a row matching only inside a roster
- [ ] #2 Roster-only matches go last (or into their own group) in the Registry search and the linker
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->
