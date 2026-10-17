---
id: MHH-087
title: >-
  The owner gets one Registry digest a day in the bell, naming every removal and
  merge
status: Done
assignee: []
created_date: '2026-10-16 23:20'
updated_date: '2026-10-16 23:25'
labels:
  - registry
milestone: m-3
dependencies: []
priority: medium
type: feature
ordinal: 84000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why** Once moderators are active, per-suggestion pings become noise; the owner still has to see everything that leaves the Registry. **Source** Plan owner answers 4 and 5 (in-app, daily, inside the refresh-market cron). **Notes** src/lib/registry/digest.ts; one guarded step in src/app/api/cron/refresh-market/route.ts; registry_digests (244) holds the day.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 The digest names every removal and every merge, with who did it
- [x] #2 It is sent at most once a day (the day's row is inserted first; only the run that inserted it rings)
- [x] #3 Bell only, no email; a quiet day rings nothing
- [x] #4 A digest failure never fails the cron run; before 242/244 it waits quietly
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Package C (b7c4e60f, a8490e85). digest.ts: covers everything since the last digest; counts by kind, every removal and merge by summary and alias (with second-look status), rules proposed or taking effect. The day's registry_digests row is inserted ON CONFLICT DO NOTHING first; only the run that inserted it rings the owner's bell (adminNotificationTargets, type registry_digest, link /catalog/desk/history). Quiet days are recorded but ring nothing. One guarded step in refresh-market; before 244 or 242 it returns pending and sends nothing.
<!-- SECTION:FINAL_SUMMARY:END -->
