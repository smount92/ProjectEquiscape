---
id: MHH-007
title: Admin Roadmap tab retired; its items live on the Backlog board
status: To Do
assignee: []
created_date: '2026-10-15 22:19'
labels:
  - admin
milestone: m-0
dependencies: []
priority: medium
type: chore
ordinal: 7000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
Two trackers means two places to look. Backlog.md is the one tracker.

**Source**
Ruling 2026-10-15 (tracker A).

**Notes**
The 22 seeded items are already tickets. The owner exports any items added since (scripts/export_roadmap_items.sql) so nothing is lost. The tables stay until a later cleanup migration.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Every live Roadmap item has a ticket
- [ ] #2 The Roadmap tab is removed from Admin
- [ ] #3 Probes 230/231 removed or marked retired
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->
