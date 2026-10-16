---
id: MHH-020
title: Deal Room disputes reach the admin
status: Done
assignee: []
created_date: '2026-10-15 22:19'
updated_date: '2026-10-16 00:45'
labels:
  - market
  - admin
milestone: m-2
dependencies: []
priority: high
type: feature
ordinal: 20000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
Disputes notify only the other party.

**Source**
Gap G2.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Admin bell on a new dispute
- [x] #2 Open disputes counted in the admin pulse
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Opening a dispute rings the owner's bell (link /admin#members); the admin pulse counts open disputes; Admin › Members lists them (parties, horse, who raised it, the reason) via listOpenDisputes (service role, owner only). /admin now opens the tab named in the address hash, so notification links land on the right tab.
<!-- SECTION:FINAL_SUMMARY:END -->
