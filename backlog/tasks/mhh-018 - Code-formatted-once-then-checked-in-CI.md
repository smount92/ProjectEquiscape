---
id: MHH-018
title: 'Code formatted once, then checked in CI'
status: To Do
assignee: []
created_date: '2026-10-15 22:19'
updated_date: '2026-10-15 23:40'
labels:
  - platform
milestone: m-0
dependencies: []
priority: low
type: chore
ordinal: 18000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
987 of 1,059 files differ from .prettierrc; formatting has never run.

**Source**
docs/STANDARDS.md plan step 6.

**Notes**
Do last in the release, when no other branch is open.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 One formatting commit
- [ ] #2 CI runs prettier --check
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Held 2026-10-15: formatting rewrites ~987 files. 30+ wt-* worktree folders and many feat/* branches exist beside the repo; any unmerged work there would conflict. Owner confirms nothing there is live, then this runs as the last commit of a release.

2026-10-15: all 28 registered worktrees (wt-*) have 0 unmerged commits and 0 uncommitted files; no local branch has work outside main; wt-cyber/paypal/perf/ref/showfollow are leftover folders, not worktrees. Safe: run last in Release 1.
<!-- SECTION:NOTES:END -->
