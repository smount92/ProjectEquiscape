---
id: MHH-021
title: 'Admin is alerted to new contact messages, reports and show submissions'
status: In Progress
assignee: []
created_date: '2026-10-15 22:19'
updated_date: '2026-10-16 00:52'
labels:
  - admin
milestone: m-2
dependencies: []
priority: high
type: feature
ordinal: 21000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
Only Registry suggestions and price flags ring the admin bell.

**Source**
Gap G3.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Bell on contact message, content report and external-show submission
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Contact messages and external-show listings now ring the owner's bell (main checkout). The content-report bell is built in the moderation worktree.
<!-- SECTION:NOTES:END -->
