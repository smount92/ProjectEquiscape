---
id: MHH-068
title: Mold pages list only sets that really contain the mold
status: Done
assignee: []
created_date: '2026-10-15 23:56'
updated_date: '2026-10-16 00:59'
labels:
  - registry
milestone: m-2
dependencies: []
priority: medium
type: bug
ordinal: 68000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
Mold pages find the sets a mold was sold in by matching the mold's name in set titles, ignoring case. A title like '... foal blanket' lists that set under the Foal mold, and '... unicorn halter' under the Unicorn mold.

**Source**
Release 1 repair review (2026-10-15).

**Notes**
mentionsMold in src/lib/linker/model.ts and getMoldSetMentions in src/app/actions/reference-pages.ts. Match the mold name as a capitalised word after 'With', as the repair generator now does.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 'foal blanket' no longer lists a set under the Foal mold
- [x] #2 Real rosters ('With Rojo') still list
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
mentionsMold (src/lib/linker/model.ts), used by mold pages and the linker, now needs the mold name capitalised after 'With' as a roster writes it: 'With Rojo' lists, 'green foal blanket' and 'unicorn halter' don't. Tests added.
<!-- SECTION:FINAL_SUMMARY:END -->
