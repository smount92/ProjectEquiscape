---
id: MHH-072
title: Stripe subscription events respect PayPal and prepaid access
status: To Do
assignee: []
created_date: '2026-10-16 01:54'
labels:
  - billing
milestone: m-1
dependencies: []
priority: high
ordinal: 72000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
handleSubscriptionChange writes tier free for any non-active Stripe subscription, with no check for a PayPal subscription or a prepaid paid_through term. A member who left Stripe for PayPal or prepaid keeps their old stripe_customer_id, so a late customer.subscription.* event on the old subscription can end access they paid for elsewhere. Release 2 stopped refunds from triggering it; the subscription events themselves still can.

**Source**
Release 2 billing review, 2026-10-15.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 A Stripe subscription ending never lowers a tier granted by PayPal or a prepaid term
- [ ] #2 Test with a cancelled Stripe subscription plus an active PayPal or prepaid tier
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->
