---
id: MHH-030
title: Registry review queue shows every open suggestion
status: Done
assignee: []
created_date: '2026-10-15 22:19'
updated_date: '2026-10-16 00:57'
labels:
  - registry
  - admin
milestone: m-2
dependencies: []
priority: medium
type: bug
ordinal: 30000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
The queue loads only 'pending', not 'under_review'; the review notification has no link back.

**Source**
Gap G12.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Both states load
- [x] #2 Review notifications link to the suggestion
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
The admin queue and the pulse count load pending and under_review suggestions; the approve/reject notice links to the suggestion.
<!-- SECTION:FINAL_SUMMARY:END -->
