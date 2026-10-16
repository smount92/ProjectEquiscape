---
id: MHH-078
title: 'Members can fill in every missing fact on a release, one after another'
status: Done
assignee: []
created_date: '2026-10-16 21:25'
updated_date: '2026-10-16 22:28'
labels:
  - registry
  - member-reported
milestone: m-3
dependencies: []
priority: medium
type: bug
ordinal: 78000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
Fill in what you know opens only the first missing fact; after filing it the member cannot reach the next. Set pieces dead-end because their colour is blocked.

**Source**
A volunteer cataloguing Breyer Stablemates, 2026-10-15/16; causes verified by two read-only investigations.

**Notes**
ReferenceLinker.tsx ReleaseRow (setFilling(gaps[0])).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 One link per missing fact
- [x] #2 A filed fact shows Sent for review and the others stay reachable
- [x] #3 A set piece offers Add this piece's own row, opening Add my release prefilled
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
ReleaseRow now offers one link per missing fact ('Know it? add the colour · add the year · add the model number'), each opening its own box with a Cancel. A filed fact shows 'The year: sent for review' (or 'saved to the Registry' when a curator's correction applies at once; fileReleaseFact now returns autoApproved) and drops out of the links, so the next one is one click away. A set piece, whose colour is deliberately blocked, offers 'add this piece's own row', which opens 'Add my release' under the mold with the set's number, set name and years filled in and scrolls it into view.
<!-- SECTION:FINAL_SUMMARY:END -->
