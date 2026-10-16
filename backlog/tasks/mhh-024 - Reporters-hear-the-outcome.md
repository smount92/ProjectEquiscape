---
id: MHH-024
title: Reporters hear the outcome
status: Done
assignee: []
created_date: '2026-10-15 22:19'
updated_date: '2026-10-16 01:23'
labels:
  - moderation
  - admin
milestone: m-2
dependencies: []
priority: medium
type: feature
ordinal: 24000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
Content reports, external-show reviews, sanctioning dismissals, barn thread status and suspensions resolve silently.

**Source**
Gap G6.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each resolution notifies the person who raised it, in plain words
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Tests pass (pre-commit)
- [x] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Every resolution now rings the bell of the person who raised it, in plain words. Content reports: each reporter of a closed report hears 'we removed it' / 'we've dealt with it' / 'it doesn't break the community rules', never who or what (moderation.ts resolveReport, reportOutcomeNotice in src/lib/moderation/reports.ts). External shows: the submitter hears approval (link to /calendar) or rejection (with the admin's note, link to /contact), once (external-shows.ts reviewExternalShow). Sanctioning: a dismissed request tells the host (admin.ts resolveSanctioningRequest). Barn threads: the author hears a new mark, with a link; clearing a mark is silent (groups.ts setThreadStatus). Suspensions: the member hears the reason and the contact page; unsuspension says they are active again (admin.ts suspendUser/unsuspendUser, so the alias wrappers too). Admin fields whose words members now read say so. Tests: moderation.test.ts, outcome-notices.test.ts. Workflow docs (member-report channel table, moderation-report tools, gaps G1/G6/G7 removed) and the Release 2 notes updated.
<!-- SECTION:FINAL_SUMMARY:END -->
