---
id: MHH-080
title: Registry search finds a title however its punctuation and word order are typed
status: Done
assignee: []
created_date: '2026-10-16 21:26'
updated_date: '2026-10-16 21:34'
labels:
  - registry
  - member-reported
milestone: m-3
dependencies: []
priority: medium
type: bug
ordinal: 80000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
Identical wording sometimes misses: quotes ("Horspital" Play Set), hyphens (12-Piece), curly apostrophes (Lover’s) and word order (Prancing Morgan vs Morgan - Prancing).

**Source**
A volunteer cataloguing Breyer Stablemates, 2026-10-15/16; causes verified by two read-only investigations.

**Notes**
search_catalog_fuzzy (223). New migration: catalog_items.search_key, trigger, backfill, GIN trigram index; the RPC matches every typed word in search_key or trigram similarity on it. Code works before the paste.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A migration adds search_key with a trigger, a backfill and a trigram index, and passes migration-standards
- [x] #2 search_catalog_fuzzy matches every typed word in search_key or similarity over the threshold, with id as the last tiebreak; grants and security unchanged
- [x] #3 One TypeScript helper normalises the term the same way, tested on the four cases
- [x] #4 Search behaves as today until the migration is pasted
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Migration 240 (awaiting paste): catalog_items.search_key as a stored generated column (not trigger + backfill, so updated_at is not stamped on every row), trigram index, and search_catalog_fuzzy also matching every typed word in search_key or key similarity over 0.15; id is the last tiebreak; search_path now ''. searchKey()/sameWords() in src/lib/catalog/searchKey.ts mirror the SQL and serve the linker, namedMolds and the old picker's ranking. The app sends the term as typed, so search behaves as today until 240 is pasted. Probe: catalog_items.search_key.
<!-- SECTION:FINAL_SUMMARY:END -->
