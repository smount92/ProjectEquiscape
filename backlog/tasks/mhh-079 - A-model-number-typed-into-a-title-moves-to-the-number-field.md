---
id: MHH-079
title: A model number typed into a title moves to the number field
status: Done
assignee: []
created_date: '2026-10-16 21:25'
updated_date: '2026-10-16 22:36'
labels:
  - registry
  - member-reported
milestone: m-3
dependencies: []
priority: medium
type: bug
ordinal: 79000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
The new-entry form keeps #5038 in the title even when the Model number box is filled. STANDARDS: titles hold the name only.

**Source**
A volunteer cataloguing Breyer Stablemates, 2026-10-15/16; causes verified by two read-only investigations.

**Notes**
One shared helper for SuggestNewEntryForm, the linker's Add my release and any suggestion path that sets a title.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A leading #NNNN or NNNN equal to the model number is stripped from the title
- [x] #2 With the number box empty, the number moves there
- [x] #3 When the two disagree, the member is asked which is right before submitting
- [x] #4 One helper with tests serves every path
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
One helper, src/lib/catalog/titleNumber.ts (leadingModelNumber, reconcileTitleNumber, applyTitleNumberRule), with tests. A leading #NNNN / NNNN (with or without a dash or colon after it) equal to the model number comes off the title; with the number box empty it moves there; when they differ the member is asked 'The name starts with #5038 but the model number says 5039. Which is right?' with a button for each. A bare year in front of a name ('2019 Holiday Horse') is left alone unless it has a #. Applied in the new-entry form (prompt), the linker's Add my release (prompt in the form, and the action refuses a mismatch), and createSuggestion as the last guard for additions and title corrections (a correction compares against the entry's own number and fills an empty one). Molds and artist pieces have no number field, so their titles stay as typed (the form used to strip and drop the number). The title placeholder no longer suggests '#712 — Misty'. Live: 128 titles start with a model number (80 equal to the stored number, 39 with none stored, 9 different); repairing those rows is a separate data fix.
<!-- SECTION:FINAL_SUMMARY:END -->
