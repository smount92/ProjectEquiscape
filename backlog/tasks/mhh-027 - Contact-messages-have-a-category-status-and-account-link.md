---
id: MHH-027
title: 'Contact messages have a category, status and account link'
status: Done
assignee: []
created_date: '2026-10-15 22:19'
updated_date: '2026-10-16 00:52'
labels:
  - admin
  - accounts
milestone: m-2
dependencies: []
priority: medium
type: enhancement
ordinal: 27000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
No category or status; only the last 100 shown; the error page reference must be typed by hand; account deletions are invisible.

**Source**
Gap G9.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Category and Open/Resolved status
- [x] #2 Error reference and signed-in account prefilled
- [x] #3 Older messages reachable
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Migration 236: contact_messages category, open/resolved status, user_id (the signed-in sender, enforced by the insert policy), error_ref, resolved_at; read messages backfilled as resolved. /contact asks what it's about and attaches the error-page reference automatically (error page links /contact?ref=digest). Admin › Mailbox is now AdminMailbox: Open/Resolved/All, category chip, account link, error reference, resolve/reopen, older messages page in. Works before 236 (everything lists as open). Tests: contact-triage.test.ts.
<!-- SECTION:FINAL_SUMMARY:END -->
