---
id: MHH-006
title: Admin can no longer create old-style photo shows
status: Done
assignee: []
created_date: '2026-10-15 22:19'
updated_date: '2026-10-15 22:43'
labels:
  - admin
  - shows
milestone: m-0
dependencies: []
priority: low
type: chore
ordinal: 6000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
A legacy path lets the admin create photo shows outside the normal host flow.

**Source**
Ruling Q20.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The legacy creation control and its action are removed
- [x] #2 Existing legacy shows still display
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Removed CreateShowForm, the createPhotoShow action and the admin Shows-tab block. Existing shows are untouched; Manage Shows stays.
<!-- SECTION:FINAL_SUMMARY:END -->
