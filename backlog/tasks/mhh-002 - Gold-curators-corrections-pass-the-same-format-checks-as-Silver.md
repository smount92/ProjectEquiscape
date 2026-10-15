---
id: MHH-002
title: Gold curators' corrections pass the same format checks as Silver
status: To Do
assignee: []
created_date: '2026-10-15 22:19'
labels:
  - registry
milestone: m-0
dependencies: []
priority: high
type: bug
ordinal: 2000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
Gold-rank corrections go live with no vocabulary or format validation; Silver must pass `silverAutoApprovable`.

**Source**
Ruling Q5.

**Notes**
src/app/actions/catalog-suggestions.ts around createSuggestion autoApprove.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A Gold correction with a malformed value files as pending instead of applying
- [ ] #2 Well-formed Gold corrections still apply at once
- [ ] #3 Test covers both
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->
