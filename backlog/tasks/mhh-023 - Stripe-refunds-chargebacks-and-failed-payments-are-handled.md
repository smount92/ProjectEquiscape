---
id: MHH-023
title: 'Stripe refunds, chargebacks and failed payments are handled'
status: To Do
assignee: []
created_date: '2026-10-15 22:19'
labels:
  - billing
milestone: m-2
dependencies: []
priority: high
type: bug
ordinal: 23000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
A refunded member keeps their tier; a failed payment is only logged.

**Source**
Gap G5; billing-issue workflow.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 charge.refunded and charge.dispute.created end the tier the purchase granted
- [ ] #2 invoice.payment_failed notifies the member
- [ ] #3 Webhook tests cover each
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->
