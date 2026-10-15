---
id: MHH-013
title: Colour check catches hex literals; muted text uses the right token
status: Done
assignee: []
created_date: '2026-10-15 22:19'
updated_date: '2026-10-15 23:16'
labels:
  - platform
milestone: m-0
dependencies: []
priority: low
type: chore
ordinal: 13000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
The hard-coded colour test misses hex and [#hex]; 29 uses of text-muted (a background token) likely render the wrong colour.

**Source**
docs/STANDARDS.md plan step 8.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Ratchet test counts hex and [#hex] outside PDFs
- [x] #2 text-muted replaced with text-muted-foreground where it is text
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
hardcoded-hex.test.ts ratchets hex literals in components (200 today, PDFs exempt). The 29 'bare text-muted' uses the audit reported were all the --leather-text-muted CSS variable; there is no bare text-muted class in use, so nothing to fix. STANDARDS.md corrected.
<!-- SECTION:FINAL_SUMMARY:END -->
