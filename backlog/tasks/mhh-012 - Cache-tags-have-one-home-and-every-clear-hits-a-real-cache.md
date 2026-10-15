---
id: MHH-012
title: Cache tags have one home and every clear hits a real cache
status: To Do
assignee: []
created_date: '2026-10-15 22:19'
labels:
  - platform
milestone: m-0
dependencies: []
priority: medium
type: chore
ordinal: 12000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
11 revalidateTag calls clear tags nothing registers; 3 caches have no tag.

**Source**
docs/STANDARDS.md plan step 7.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 lib/cache/tags.ts lists every tag
- [ ] #2 A test fails on a revalidateTag with an unregistered tag
- [ ] #3 The 3 untagged caches carry tags
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->
