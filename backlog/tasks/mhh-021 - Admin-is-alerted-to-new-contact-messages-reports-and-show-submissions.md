---
id: MHH-021
title: 'Admin is alerted to new contact messages, reports and show submissions'
status: Done
assignee: []
created_date: '2026-10-15 22:19'
updated_date: '2026-10-16 01:34'
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
- [x] #1 Bell on contact message, content report and external-show submission
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Both halves built for Release 2. Contact messages and external-show listings ring the owner's bell (links /admin#mailbox, /admin#calendar). Content reports ring it too (submitReport, linking /admin?tab=reports). AdminTabs opens the tab named by ?tab= or #hash.
<!-- SECTION:NOTES:END -->
