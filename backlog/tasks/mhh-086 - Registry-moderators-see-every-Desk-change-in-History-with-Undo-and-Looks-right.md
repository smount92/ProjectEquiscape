---
id: MHH-086
title: >-
  Registry moderators see every Desk change in History, with Undo and Looks
  right
status: Done
assignee: []
created_date: '2026-10-16 23:20'
updated_date: '2026-10-16 23:25'
labels:
  - registry
milestone: m-3
dependencies: []
priority: medium
type: feature
ordinal: 83000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why** Moderators' changes go live unreviewed, so every change must be visible, checkable after the fact, and undoable for 30 days. **Source** Registry moderators design (History, Looks right); plan Package C. **Notes** /catalog/desk/history; actions getHistory, undoAction (through write.ts undoAction), markLooksRight; reads 242's registry_actions.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 History lists Desk actions newest first, filterable by who and by kind, with the actor's name and role
- [x] #2 Undo is offered within 30 days and goes through the one Registry writer with a reason
- [x] #3 Looks right is never offered on your own change
- [x] #4 Before update 242 the tab says when History starts, without failing
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Package C (a8490e85). /catalog/desk/history: Desk actions from 242's registry_actions, newest first, filter by who (everyone, mine, everyone else) and kind, with alias and role. Undo within 30 days with a reason, through write.ts undoAction (Package A); Looks right only on someone else's applied change, guarded. Before 242 the tab says History starts once update 242 is added.
<!-- SECTION:FINAL_SUMMARY:END -->
