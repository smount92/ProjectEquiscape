---
id: MHH-091
title: The owner can appoint and remove Registry moderators
status: Done
assignee: []
created_date: '2026-10-16 23:31'
updated_date: '2026-10-16 23:36'
labels:
  - registry
milestone: m-3
dependencies: []
priority: high
type: feature
ordinal: 88000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why** Registry clean-up is community-driven: vetted moderators get the owner's Registry powers on the Registry Desk (DECISIONS 2026-10-16). **Source** Owner rulings 2026-10-16; docs/design/registry-desk-phase1-plan.md, Package A. **Notes** Migration 242 (registry_moderators, registry_actions, registry_action_rows, changelog actor_role, suggestion claims); requireRegistryModerator / registryRoleOf in src/lib/auth.ts; Admin > Members strip with Make moderator / Remove; per-suggestion owner pings stop once a moderator is active.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Admin > Members lists the moderators and offers Make moderator and Remove moderator on member rows
- [x] #2 A removed, resting or stepped-down moderator, or a suspended account, is refused on the next Desk action
- [x] #3 Before 242 is pasted only the owner passes the role check and the tab says to add update 242
- [x] #4 Once a moderator is active the owner no longer gets a bell for every new suggestion
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Tests pass (pre-commit)
- [x] #2 Decision recorded in docs/DECISIONS.md if one was made
- [x] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Branch desk-a-engine: requireRegistryModerator / registryRoleOf (src/lib/auth.ts), migration 242, owner grant/remove actions and the Admin > Members moderators strip, owner pings stop once a moderator is active. Owner pastes 242, then 243.
<!-- SECTION:FINAL_SUMMARY:END -->
