---
id: MHH-025
title: Report cards link to the content and can take it down
status: Done
assignee: []
created_date: '2026-10-15 22:19'
updated_date: '2026-10-16 01:15'
labels:
  - moderation
  - admin
milestone: m-2
dependencies: []
priority: medium
type: enhancement
ordinal: 25000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
Cards show an 8-character id and 'Take action' only saves a note.

**Source**
Gap G7.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each card links to the content
- [x] #2 Hide/Remove from the card
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Tests pass (pre-commit)
- [x] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Each Admin › Reports card now shows the kind of content, what was reported (title or excerpt, or the message's words), who made it, its state, the reporter's details and an 'Open it' link (src/lib/moderation/reportTargets.ts describeReportTargets, one query per kind). Actions (ReportActions → resolveReport, the one way a report closes; every outcome records a note and status): take down per kind (hide post/reply/Help ID row via hidden_at, migration 235 with restrictive row policies; remove a chat message via messages.deleted_at, shown as 'removed by a moderator' and cleared from the inbox preview; make a horse private and end its listing; scratch a show entry, refusing after results with a pointer to Strike), 'Doesn't break the rules' (dismissed), 'Dealt with another way' (actioned, note required), and 'Suspend @alias…' which opens Admin › Members already searching for them. A take-down closes every open report on the same content and tells its maker, with the contact page. Nothing is deleted (Q28).
<!-- SECTION:FINAL_SUMMARY:END -->
