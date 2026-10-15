---
id: MHH-015
title: 'Pipeline: checks run on a branch, the site builds once per release'
status: In Progress
assignee: []
created_date: '2026-10-15 22:19'
updated_date: '2026-10-15 22:37'
labels:
  - platform
milestone: m-0
dependencies: []
priority: high
type: feature
ordinal: 15000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
Every push to main rebuilds the site; checks are thin. Owner wants a proper CI/CD pipeline with testing and auditing, and fewer rebuilds.

**Source**
Ruling Q2 (2026-10-15).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Work goes to a release branch; pushing it runs checks on GitHub only
- [ ] #2 Vercel builds only main (preview builds off)
- [ ] #3 CI: tests, lint, types, build, migration checks (numbering, re-runnable), dependency audit
- [ ] #4 Dependabot weekly security updates
- [ ] #5 Release = one merge to main on the owner's word
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->
