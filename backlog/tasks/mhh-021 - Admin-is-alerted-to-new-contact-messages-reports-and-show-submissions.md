---
id: MHH-021
title: 'Admin is alerted to new contact messages, reports and show submissions'
status: To Do
assignee: []
created_date: '2026-10-15 22:19'
updated_date: '2026-10-16 01:03'
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
Report half done (worktree branch, commit after MHH-019): submitReport rings the admin bell (adminNotificationTargets, type system) with the kind of content and the reason, linking to /admin?tab=reports; AdminTabs now opens the tab named in ?tab=. Contact messages and external-show submissions are the other half.
<!-- SECTION:NOTES:END -->
