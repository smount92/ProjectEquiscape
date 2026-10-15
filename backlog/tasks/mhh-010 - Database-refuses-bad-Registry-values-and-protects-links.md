---
id: MHH-010
title: Database refuses bad Registry values and protects links
status: To Do
assignee: []
created_date: '2026-10-15 22:19'
labels:
  - registry
  - data
milestone: m-0
dependencies: []
priority: high
type: enhancement
ordinal: 10000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
No constraint on scale, run type or material; want lists can hold duplicates since migration 052; deleting a catalog row silently unlinks horses.

**Source**
docs/STANDARDS.md plan step 3.

**Notes**
Runs after the format repair clears today's violations.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 CHECK constraints on scale, run_type and material generated from taxonomy.ts
- [ ] #2 A test fails when taxonomy.ts and the CHECK lists differ
- [ ] #3 user_wishlists (user_id, catalog_id) is unique
- [ ] #4 catalog_id foreign keys are ON DELETE RESTRICT
- [ ] #5 catalog_items and user_horses have updated_at kept by a trigger
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->
