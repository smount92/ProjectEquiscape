---
id: MHH-007
title: Admin Roadmap tab retired; its items live on the Backlog board
status: Done
assignee: []
created_date: '2026-10-15 22:19'
updated_date: '2026-10-15 22:45'
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
- [x] #1 Every live Roadmap item has a ticket
- [x] #2 The Roadmap tab is removed from Admin
- [x] #3 Probes 230/231 removed or marked retired
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Owner exported the live table: the three items added since the seed are MHH-063, MHH-064 and a note on MHH-042; 'Reply to MHI, Starshore and Misty' was already done. Removed the tab, its actions, component, model and tests. Tables roadmap_items/roadmap_events stay until a cleanup migration; probes 230/231 say so.
<!-- SECTION:FINAL_SUMMARY:END -->
