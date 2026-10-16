---
id: MHH-082
title: A horse's new owner never sees the seller's private vault details
status: To Do
assignee: []
created_date: '2026-10-16 21:49'
labels:
  - stable
  - accounts
milestone: Release 3 - Registry cleanup
dependencies: []
priority: high
type: bug
ordinal: 75000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
The Financial Vault is strictly private, but the vault row stays with the horse when it changes owner. Transfers (migration 180) clear price, value, insurance notes and date, yet leave commission cost and notes, the approximate purchase date, the set label and the trade flag, so a buyer can read what the seller recorded. 241 clears purchase notes on transfer.

**Source**
Found while building vault purchase notes, 2026-10-16.

**Notes**
Owner call: clearing the rest changes current behaviour (a buyer stops seeing a commission record). Recommendation: clear every seller field on transfer; the buyer starts an empty vault.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 After a transfer the buyer's vault holds nothing the seller entered
- [ ] #2 Test covering every vault column on transfer
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->
