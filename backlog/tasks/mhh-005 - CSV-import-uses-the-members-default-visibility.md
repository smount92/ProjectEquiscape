---
id: MHH-005
title: CSV import uses the member's default visibility
status: Waiting on owner
assignee: []
created_date: '2026-10-15 22:19'
updated_date: '2026-10-15 22:41'
labels:
  - stable
milestone: m-0
dependencies: []
priority: medium
type: bug
ordinal: 5000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
Imported horses are always public; that default was an agent's choice, not the owner's.

**Source**
Ruling Q11.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Imported horses take the member's default visibility setting
- [ ] #2 Test covers public and private defaults
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Found 2026-10-15: members have no default-visibility setting. CSV import has a 'publish imported horses' checkbox that starts ticked, like Quick Add's public default. Options: (a) start the checkbox unticked; (b) add a member setting 'New horses start as Public/Private' used by Add Horse, Quick Add and CSV import (one migration + settings + three forms).
<!-- SECTION:NOTES:END -->
