---
id: MHH-083
title: CSV import can set purchase notes
status: To Do
assignee: []
created_date: '2026-10-16 21:49'
labels:
  - stable
milestone: m-1
dependencies: []
priority: low
type: enhancement
ordinal: 76000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
Spreadsheet import writes the vault through batch_import_horses_v3 (234, SECURITY DEFINER) and doesn't carry purchase notes yet.

**Source**
Vault purchase notes build, 2026-10-16.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A Purchase notes column in the import template is saved
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->
