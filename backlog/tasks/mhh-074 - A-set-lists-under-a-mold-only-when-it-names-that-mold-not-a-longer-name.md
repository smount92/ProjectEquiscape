---
id: MHH-074
title: 'A set lists under a mold only when it names that mold, not a longer name'
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
- [ ] #1 A roster is split after With on commas, & and and; each piece is compared whole to the mold name
- [ ] #2 12-Piece Stablemates Set With Arabian Mare, American Saddlebred does not list under Saddlebred and does list under American Saddlebred
- [ ] #3 MHH-068 accessory rule still holds
- [ ] #4 Linker lines on the SM Saddlebred mold measured before and after
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->
