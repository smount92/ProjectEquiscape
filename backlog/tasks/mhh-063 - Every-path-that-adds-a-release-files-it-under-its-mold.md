---
id: MHH-063
title: Every path that adds a release files it under its mold
status: To Do
assignee: []
created_date: '2026-10-15 22:27'
labels:
  - registry
  - member-reported
milestone: m-0
dependencies: []
priority: high
type: bug
ordinal: 63000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
Approved additions used to keep the typed mold name as text and never set the mold, so releases members added were invisible under their mold (517 orphans on 2026-10-12).

**Source**
Old Roadmap item (Stablemate member message 2026-10-12).

**Notes**
Done so far: approval resolves the mold (resolveParentMold), the linker files under the chosen mold, repair scripts ran. Left: CSV import and the delta tool use the same resolver; the suggestion form offers a mold picker instead of free text.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 CSV import sets the mold for releases it adds
- [ ] #2 The delta import tool sets the mold
- [ ] #3 The suggestion form picks a mold from the Registry, with free text only as a fallback
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->
