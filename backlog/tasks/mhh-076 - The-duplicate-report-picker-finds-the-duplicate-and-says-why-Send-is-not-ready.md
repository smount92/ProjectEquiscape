---
id: MHH-076
title: The duplicate-report picker finds the duplicate and says why Send is not ready
status: Done
assignee: []
created_date: '2026-10-16 21:25'
updated_date: '2026-10-16 22:02'
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
- [x] #1 One shared searchRegistry(term) serves the Registry search and the picker
- [x] #2 Up to 25 results, scrollable, each with model number, years, colour and mold; same-mold results first
- [x] #3 With nothing picked, the Send button says why
- [x] #4 Black and White Saddlebred finds Pinto Saddlebred #5002
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
searchRegistry() (src/lib/catalog/registrySearch.ts) is now the one Registry name search: maker preference, SM/G1 stripped, named mold expanded, roster-only sets last, term sent as typed (no punctuation dropped). getCatalogItems, searchCatalogAction (old picker, wishlist) and the new findRegistryEntries picker action all call it. The picker shows up to 25 scrollable entries with #number · years · colour · mold, leaves out the reported entry, and orders best answers first with the same mold, then the same scale, leading within each band (same mold over everything pushed an exact typed name to #16); a typed model number counts as naming its row, and a number alone searches by number. With nothing typed it lists the other entries on the same mold. The Send button reads 'Pick the entry to keep first' / 'Say how you can tell (10+ characters)' until it can send. Live, reported from #5904 Black and White Saddlebred: 'Black and White Saddlebred' puts Pinto Saddlebred #5002 at #20 of 25 (before: not among the 8 shown, 32nd of the search); 'Saddlebred #5002' at #2; 'Pinto Saddlebred' at #1.
<!-- SECTION:FINAL_SUMMARY:END -->
