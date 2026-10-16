---
id: MHH-084
title: >-
  Registry moderators see to-do lists of what needs fixing, found by scanning
  the whole Registry
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
ordinal: 81000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why** The owner runs registry_health.mjs by hand; moderators need the same work lists, Stablemates first (2026-10-16 survey), so two people don't fix the same rows. **Source** Registry Desk Phase 1 plan, Package C; approved mock (To-do tab); owner answer 1 (roster in a set title is a neutral note). **Notes** src/lib/registry/checks.ts, todo.ts; routes /catalog/desk/todo and /catalog/desk/todo/[list]; migration 244 (registry_todo_claims).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each list's count equals the health scan's on the same rows (test-held for every shared check)
- [x] #2 Each flag has a positive and a negative test; number clash ignores a set's own pieces; generation tags are checked on Breyer Stablemate molds only
- [x] #3 I'm on it claims a list or a row for a day; Done takes a row off until the next check
- [x] #4 Lists are cached an hour and cleared by any Registry write (referencePages) or Check again (registryTodo)
- [x] #5 Rows open the Mold view with the release picked
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Package C, branch desk-c-lists (b7c4e60f, a8490e85). src/lib/registry/checks.ts computes 17 lists from every Registry row (the health scan's rules where shared; checks.test.ts runs the scan's own expressions on the same fixture and holds the counts equal). Stablemates first. todo.ts caches them an hour under registryTodo and referencePages; claims (registry_todo_claims, 244) are read live. /catalog/desk/todo and /catalog/desk/todo/[list]: I'm on it for a day, Done until the next check, Check again (rate-limited). Up to 300 rows kept per list. Rows open /catalog/desk/mold/<mold>?release=<id>.
<!-- SECTION:FINAL_SUMMARY:END -->
