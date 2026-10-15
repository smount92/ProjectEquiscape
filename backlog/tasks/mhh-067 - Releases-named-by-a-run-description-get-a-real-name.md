---
id: MHH-067
title: Releases named by a run description get a real name
status: To Do
assignee: []
created_date: '2026-10-15 23:40'
labels:
  - registry
  - data
milestone: m-1
dependencies: []
priority: medium
type: enhancement
ordinal: 67000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
Many release titles are a run description from the March import ('BreyerFest Special Run (1,113 made) Split run of ...') rather than the release's name, so members can't find or recognise them.

**Source**
MHH-003 review list (2026-10-15); owner rule: the better product wins.

**Notes**
Needs a source of real names per model number (makers' own lists, member knowledge). Keep the description in the release notes; facts, not prose (sourcing ethics).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Each run-description title has a proposed name with its source
- [ ] #2 Owner reviews the list; a guarded repair applies it
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->
