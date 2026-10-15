---
id: MHH-001
title: Old Registry addresses forward to the new one after a maker correction
status: Done
assignee: []
created_date: '2026-10-15 22:19'
updated_date: '2026-10-15 22:54'
labels:
  - registry
milestone: m-0
dependencies: []
priority: high
type: enhancement
ordinal: 1000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
Migration 232 moves a page when its maker is corrected, so old links (shared, bookmarked, indexed) return 404.

**Source**
Ruling Q1 (2026-10-15).

**Notes**
Needs a small slug-history table (migration) and a lookup in the reference page route that redirects permanently.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A corrected maker's old reference address redirects (308) to the new one
- [x] #2 Redirects survive a second correction
- [x] #3 The migration is re-runnable and has an Ops probe
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Migration 233: catalog_slug_history (public read) filled by the maker-slug trigger (now also on slug changes) and by every merge (lib/catalog/merge.ts records the duplicate's address and moves older ones). Reference item pages and maker pages permanentRedirect old addresses; until 233 is pasted the lookup quietly finds nothing and pages 404 as before. Backfills /reference/breyer/silky-sullivan. Probe added.
<!-- SECTION:FINAL_SUMMARY:END -->
