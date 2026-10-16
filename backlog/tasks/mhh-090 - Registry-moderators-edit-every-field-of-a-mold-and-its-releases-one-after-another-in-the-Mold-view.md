---
id: MHH-090
title: >-
  Registry moderators edit every field of a mold and its releases, one after
  another, in the Mold view
status: Done
assignee: []
created_date: '2026-10-16 23:28'
updated_date: '2026-10-16 23:28'
labels:
  - registry
milestone: m-3
dependencies: []
priority: medium
type: feature
ordinal: 82000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why** Owner, 2026-10-16: make sure that all of the information is available to edit, not just the few fields that show up; select the mold, click through each release, its info comes up below to edit and save. **Source** Owner ruling 2026-10-16 (DECISIONS rulings log); docs/design/registry-desk-phase1-plan.md Package B. **Notes** /catalog/desk/mold and /catalog/desk/mold/[id]?release=; DESK_FIELDS and buildDeskFields in src/lib/catalog/editableFields.ts; components MoldPicker, MoldView, ReleaseRail, ItemEditor, DeskField, FlagChips, SuggestedFixes, MergeDialog, RemoveDialog, ConflictNotice, useDeskKeys.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The editor shows every field on the row: every column, every curated fact, every other attribute, the import details (folded) and the record's facts (read-only)
- [x] #2 The Mold view lists only rows filed under the mold; a set row under another mold never shows
- [x] #3 J and K (not while typing) and Prev and Next move between releases; Ctrl or Cmd+S saves; the address keeps ?release=
- [x] #4 Unsaved changes stay with each release while moving, with a dot on the rail, and leaving the page with any asks first
- [x] #5 A save that lost a race shows the other version and lets the moderator keep theirs or take the other
- [x] #6 At 375px the rail is a list above the editor, fields are one column, and Prev, Save and Next stay at the bottom
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Tests pass (pre-commit)
- [x] #2 Decision recorded in docs/DECISIONS.md if one was made
- [x] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Built on branch desk-b-ui (Package B): DESK_FIELDS and buildDeskFields in editableFields.ts (member list unchanged), /catalog/desk/mold picker and /catalog/desk/mold/[id]?release=, MoldView with ReleaseRail, ItemEditor, DeskField, FlagChips, SuggestedFixes, MergeDialog, RemoveDialog, ConflictNotice and useDeskKeys. Tests: editableFields.desk.test.ts, ItemEditor.test.tsx. Flags and suggested fixes appear once Package C's checks.ts and fixes.ts replace the placeholders. No Playwright look-see at 375px (no local moderator login); the 375px layout is covered by the markup only.
<!-- SECTION:FINAL_SUMMARY:END -->
