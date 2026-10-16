---
id: MHH-074
title: 'A set lists under a mold only when it names that mold, not a longer name'
status: Done
assignee: []
created_date: '2026-10-16 21:25'
updated_date: '2026-10-16 21:39'
labels:
  - registry
  - member-reported
milestone: m-3
dependencies: []
priority: high
type: bug
ordinal: 74000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
The linker and the mold page match a mold's name as a word inside a set's roster, so "American Saddlebred" counts as the Stablemate "Saddlebred" mold. The SM Saddlebred mold shows 45 lines for 24 releases.

**Source**
A volunteer cataloguing Breyer Stablemates, 2026-10-15/16; causes verified by two read-only investigations.

**Notes**
mentionsMold in src/lib/linker/model.ts; callers: expandMold (actions/linker.ts), getMoldSetMentions (actions/reference-pages.ts), collapseSetPieces. Keep MHH-068 (a lowercase accessory is not a mold).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A roster is split after With on commas, & and and; each piece is compared whole to the mold name
- [x] #2 12-Piece Stablemates Set With Arabian Mare, American Saddlebred does not list under Saddlebred and does list under American Saddlebred
- [x] #3 MHH-068 accessory rule still holds
- [x] #4 Linker lines on the SM Saddlebred mold measured before and after
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
mentionsMold now compares whole roster pieces (rosterPieces: split after With on commas, &, and, a further with; brackets and trailing punctuation dropped; lowercase pieces stay accessories per MHH-068) to the mold name with sameWords, so word order and punctuation do not matter but a longer name never matches. The candidate read (expandMold and the mold page's getMoldSetMentions) now asks for with + every word of the name, up to 400 rows (was %with%NAME%, 80 in the linker), so common names are not cut short; mold-page cache key bumped to v3. Measured on the live Registry: SM Saddlebred 8c8e5586 linker lines 45 -> 28 (24 own + 4 set lines), set rows 49 -> 14; across 120 SM molds set rows 1,502 -> 1,352. Arabian - Walking and Arabian - Rearing gain 11 true set lines each (Walking Arabian, Arabian-Rearing pieces).
<!-- SECTION:FINAL_SUMMARY:END -->
