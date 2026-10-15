---
id: MHH-016
title: Smoke test runs against the live site after each release
status: Done
assignee: []
created_date: '2026-10-15 22:19'
updated_date: '2026-10-15 23:24'
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
- [x] #1 A post-deploy job opens home, Registry search, a reference page, a passport and a show page
- [x] #2 A failure is reported to the owner
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
live-smoke.yml runs e2e/live on each successful Production deployment (and by hand); passed against production and against a local build of this release. GitHub emails the owner on failure.
<!-- SECTION:FINAL_SUMMARY:END -->
