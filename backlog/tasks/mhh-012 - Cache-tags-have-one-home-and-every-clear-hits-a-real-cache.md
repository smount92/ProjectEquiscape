---
id: MHH-012
title: Cache tags have one home and every clear hits a real cache
status: Done
assignee: []
created_date: '2026-10-15 22:19'
updated_date: '2026-10-15 23:11'
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
- [x] #1 lib/cache/tags.ts lists every tag
- [x] #2 A test fails on a revalidateTag with an unregistered tag
- [x] #3 The 3 untagged caches carry tags
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
src/lib/cache/tags.ts holds every tag; cache-tags.test.ts refuses typed strings in revalidateTag and tags lists. Horse changes now clear the Show Ring facets cache (was the dead 'public_horses'); legacy show status clears show results; public shows cache tagged; dead 'events', 'groups' and 'feed' clears removed (they cleared nothing).
<!-- SECTION:FINAL_SUMMARY:END -->
