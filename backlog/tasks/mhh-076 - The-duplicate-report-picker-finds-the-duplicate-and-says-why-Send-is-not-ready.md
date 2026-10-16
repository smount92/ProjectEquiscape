---
id: MHH-076
title: The duplicate-report picker finds the duplicate and says why Send is not ready
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
ordinal: 76000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
The Report a duplicate picker shows 8 results with no mold expansion, no SM/G1 stripping and punctuation dropped, so the duplicate never appears and Send looks dead.

**Source**
A volunteer cataloguing Breyer Stablemates, 2026-10-15/16; causes verified by two read-only investigations.

**Notes**
src/components/ReportDuplicateModal.tsx uses searchCatalogAction (actions/reference.ts). Extract searchRegistry(term) from getCatalogItems.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 One shared searchRegistry(term) serves the Registry search and the picker
- [ ] #2 Up to 25 results, scrollable, each with model number, years, colour and mold; same-mold results first
- [ ] #3 With nothing picked, the Send button says why
- [ ] #4 Black and White Saddlebred finds Pinto Saddlebred #5002
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->
