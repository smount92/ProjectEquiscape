---
id: MHH-026
title: Entrants can message the host about an entry
status: Done
assignee: []
created_date: '2026-10-15 22:19'
updated_date: '2026-10-16 01:17'
labels:
  - shows
milestone: m-2
dependencies: []
priority: medium
type: feature
ordinal: 26000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
No way to dispute a result, bar or scratch except outside the site.

**Source**
Gap G8.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 'Message the host' on an entry opens a DM with the show and entry attached
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Tests pass (pre-commit)
- [x] #2 Decision recorded in docs/DECISIONS.md if one was made
- [x] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Built: /shows/[id]/message-host (page + messageShowHost action), show masthead link, Ask the host on each My Entries row (?entry= preselects), bar/scratch/removal notices link there. Nothing is created until Send. Tests: show-host-message.test.ts, ShowEntrySectionParts.test.tsx.
<!-- SECTION:NOTES:END -->
