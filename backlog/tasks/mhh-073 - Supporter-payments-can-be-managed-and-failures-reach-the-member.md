---
id: MHH-073
title: Supporter payments can be managed and failures reach the member
status: To Do
assignee: []
created_date: '2026-10-16 01:55'
labels:
  - billing
milestone: m-1
dependencies: []
priority: low
ordinal: 73000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
Supporter checkout never stores stripe_customer_id, so a supporter-only member gets no Manage billing button and no payment-failed notice, and the failed-payment wording says membership even for a supporter charge.

**Source**
Release 2 billing review, 2026-10-15.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Supporter checkout records the Stripe customer
- [ ] #2 Payment-failed notice wording fits supporter charges
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->
