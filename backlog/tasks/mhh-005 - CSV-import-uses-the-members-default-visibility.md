---
id: MHH-005
title: CSV import uses the member's default visibility
status: Done
assignee: []
created_date: '2026-10-15 22:19'
updated_date: '2026-10-15 23:39'
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
- [x] #1 Imported horses take the member's default visibility setting
- [x] #2 Test covers public and private defaults
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

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Found: Settings saved default_horse_public but no add path read it (members who chose private still got public horses). Migration 234 adds users.default_horse_visibility (Public/Unlisted/Private, carried over from the on/off value; authenticated-only column grant) and batch_import_horses_v3 (v2 + a visibility; generated from 144's text, diff-checked). lib/stable/defaultVisibility.ts is the one reader (falls back to the old boolean before 234). Settings shows a three-way choice; Add Horse and Quick Add start from it; CSV import has a three-way choice defaulting to it (v3, falling back to v2 with Unlisted landing Private). Tests added. Owner rule 2026-10-15: the better product wins.
<!-- SECTION:FINAL_SUMMARY:END -->
