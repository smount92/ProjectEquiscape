---
id: MHH-079
title: A model number typed into a title moves to the number field
status: To Do
assignee: []
created_date: '2026-10-16 21:25'
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
- [ ] #1 A leading #NNNN or NNNN equal to the model number is stripped from the title
- [ ] #2 With the number box empty, the number moves there
- [ ] #3 When the two disagree, the member is asked which is right before submitting
- [ ] #4 One helper with tests serves every path
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->
