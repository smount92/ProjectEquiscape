---
id: MHH-029
title: Crons report a heartbeat
status: Done
assignee: []
created_date: '2026-10-15 22:19'
updated_date: '2026-10-16 01:04'
labels:
  - platform
milestone: m-2
dependencies: []
priority: medium
type: feature
ordinal: 29000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
A cron that stops silently is invisible.

**Source**
Gap G11.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Each cron records its last success
- [x] #2 Admin › Ops shows each cron, red when late
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Migration 237 cron_heartbeats (service role only). withHeartbeat (src/lib/ops/heartbeat.ts) wraps all four cron routes: each authorised run records last_run/last_ok or last_failed + error; 401 pokes don't count; recording never breaks a job and is silent before 237. Admin › Ops › Scheduled jobs shows each job's schedule, last success and state (On time / Late / Failing / No runs yet). Tests: heartbeat.test.ts.
<!-- SECTION:FINAL_SUMMARY:END -->
