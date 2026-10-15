---
id: MHH-011
title: A horse's history can never be cascade-deleted
status: Done
assignee: []
created_date: '2026-10-15 22:19'
updated_date: '2026-10-15 22:54'
labels:
  - platform
  - data
milestone: m-0
dependencies: []
priority: medium
type: enhancement
ordinal: 11000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
27 foreign keys cascade from user_horses, including ownership history, transfers and show records. Soft delete protects them today; a hard delete would erase history.

**Source**
docs/STANDARDS.md plan step 4.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 History tables reference user_horses with RESTRICT
- [x] #2 Soft delete and Recently Deleted still work (tests)
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Migration 233 switches the horse_id foreign keys of ownership history, transfers, timeline, show records, show class entries, qualification cards, titles, condition history, work records, papers and accomplishments to ON DELETE RESTRICT (found by catalog lookup, so missing tables are skipped). Horses are soft-deleted, so nothing on the site changes; tests pass.
<!-- SECTION:FINAL_SUMMARY:END -->
