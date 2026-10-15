---
id: MHH-014
title: Database types regenerated and kept current
status: Done
assignee: []
created_date: '2026-10-15 22:19'
updated_date: '2026-10-15 23:14'
labels:
  - platform
milestone: m-0
dependencies: []
priority: medium
type: chore
ordinal: 14000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
database.generated.ts dates from 23 Aug and lacks 9 tables.

**Source**
docs/STANDARDS.md plan step 9.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Types regenerated
- [x] #2 add-migration skill step confirmed in practice
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Regenerated database.generated.ts (6,868 → 7,313 lines); the 9 missing tables are in. One real mismatch surfaced (eBay cron listings → jsonb) and is typed. Regenerate once more after migration 233 is pasted (adds catalog_slug_history, updated_at).
<!-- SECTION:FINAL_SUMMARY:END -->
