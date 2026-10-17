---
id: MHH-075
title: Searching a mold puts its own releases above sets that only list it
status: Done
assignee: []
created_date: '2026-10-16 21:25'
updated_date: '2026-10-16 21:49'
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
- [x] #1 A row whose own mold or own name (before With) matches ranks above a row matching only inside a roster
- [x] #2 Roster-only matches go last (or into their own group) in the Registry search and the linker
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
matchKind() in lib/catalog/moldSearch sorts each candidate into own (its title before With, or its mold, holds every typed word), roster (only a set's roster does) or other; rosterLast() moves roster-only rows to the end. getCatalogItems applies it after the mold expansion and returns rosterFrom; /catalog draws a 'Sets that include ...' heading there (SetsHeadingSplit, cards and table) rather than mixing sets in: chose a heading over plain 'last' because a member then reads them as sets, not more of the mold. searchCatalogAction (old picker, wishlist) and the linker's resins-and-others list apply the same order; the linker's mold groups already rank set lines after singles and item 1 fixed which sets appear. Live 'Arabian Stallion' with the Stablemate chip: 48 SM rows, the 22 that are or sit on the name first, then 26 roster-only sets under the heading (before: a roster set at #21, mixed in).
<!-- SECTION:FINAL_SUMMARY:END -->
