---
id: MHH-069
title: Remove the dead /show-ring public path
status: Done
assignee: []
created_date: '2026-10-15 23:56'
updated_date: '2026-10-16 00:59'
labels:
  - platform
milestone: m-2
dependencies: []
priority: low
type: chore
ordinal: 69000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
src/proxy.ts lists /show-ring as public, but no page exists there; the Show Ring is /community and is members-only.

**Source**
Release 1 pipeline review (2026-10-15).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 proxy public list matches real public pages
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed /show-ring from the proxy's public paths; no page or link used it (the Show Ring is /community, members-only).
<!-- SECTION:FINAL_SUMMARY:END -->
