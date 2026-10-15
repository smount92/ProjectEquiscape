---
id: MHH-016
title: Smoke test runs against the live site after each release
status: To Do
assignee: []
created_date: '2026-10-15 22:19'
labels:
  - platform
milestone: m-0
dependencies: []
priority: medium
type: feature
ordinal: 16000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
A release should prove itself: key public pages load and Registry search works.

**Source**
Ruling Q2.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A post-deploy job opens home, Registry search, a reference page, a passport and a show page
- [ ] #2 A failure is reported to the owner
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->
