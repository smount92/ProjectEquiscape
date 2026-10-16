---
id: MHH-032
title: New linker becomes the default; old picker removed
status: In Progress
assignee: []
created_date: '2026-10-15 22:19'
updated_date: '2026-10-16 01:43'
due_date: '2026-10-29'
labels:
  - registry
milestone: m-2
dependencies: []
priority: medium
type: chore
ordinal: 32000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
Two weeks with no new linker bug, counted from 2026-10-15.

**Source**
Ruling Q7.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 No linker bug filed since 2026-10-15
- [x] #2 New linker is the default
- [x] #3 Old picker and the switch are deleted
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Ready on branch linker-default (from release-2). Not merged, not pushed: ships only after 2026-10-29 if no linker bug is filed (AC #1, the owner's gate).

AC #2: AddHorseEngine, QuickAddEngine and EditHorseEngine render ReferenceLinker directly. A ?linker=new|old link is now simply ignored.

AC #3: deleted ReferenceLinkerSwitch (and its Try/Return banner and linker_switch event), UnifiedReferenceSearch, lib/catalog/searchRank.ts + its test, getReleasesForMold (reference.ts), the .ref-selected-parent CSS, LINKER_PREF_KEY/LinkerPref; writePref is now internal to prefs.ts (useLocalPref still keeps the scale chip).

Parity gaps found in the old picker and carried into the linker:
- An existing link (edit form, ?catalog= add, coming back to the step) showed only 'Already linked' with no name and no way to unlink. The linker now names it (labelForItem) with Unlink; the edit form's duplicate 'Linked to' line went.
- Market value badge on the linked item: now in the linked banner.
- Releases with no mold (orphans) could not be found by name: searchLinker returns them as loose and the linker lists them under 'Releases without a mold yet'.
- Resin finish floated resins first: the linker now shows 'Resins and other pieces' above molds for a resin horse.
- The banner hides when the host unlinks (no stale 'Linked:').
Not ported: externalSearchQuery and aiNotice (no form passed them since the AI mold-ID tool was removed in d652b739); the All/OF/Resins type chips (replaced by scale chips and the grouped layout); the Blue Book link in the empty state.

Docs: GLOSSARY Linker, components/catalog.md, api/server-actions.md, ADR 007 note, investigate-bug skill.
<!-- SECTION:NOTES:END -->
