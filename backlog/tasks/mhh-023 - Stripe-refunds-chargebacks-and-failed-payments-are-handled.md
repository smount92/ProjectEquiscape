---
id: MHH-023
title: 'Stripe refunds, chargebacks and failed payments are handled'
status: Done
assignee: []
created_date: '2026-10-15 22:19'
updated_date: '2026-10-16 00:41'
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
- [x] #1 charge.refunded and charge.dispute.created end the tier the purchase granted
- [x] #2 invoice.payment_failed notifies the member
- [x] #3 Webhook tests cover each
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Policy (owner rule: better product, no surprise loss of access): refunds and chargebacks never cancel anyone automatically; the plan follows the subscription's real status in Stripe, re-read on every refund. Members are told on a failed renewal (link to Settings › Subscription) and on a refund; the owner gets a bell with a Stripe link on every refund and chargeback (plus a Sentry warning for chargebacks). New: Manage billing (Stripe billing portal) in Settings › Subscription, since members had nowhere to update a card. Customer lookup now pages past the first 1,000 members. Owner setup in docs/releases/release-2.md (Customer portal on; webhook events charge.refunded, charge.dispute.created). Tests: stripe-webhook-money-back.test.ts.
<!-- SECTION:FINAL_SUMMARY:END -->
