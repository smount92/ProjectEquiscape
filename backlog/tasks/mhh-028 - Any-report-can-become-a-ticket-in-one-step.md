---
id: MHH-028
title: Any report can become a ticket in one step
status: Done
assignee: []
created_date: '2026-10-15 22:19'
updated_date: '2026-10-16 02:59'
labels:
  - admin
milestone: m-2
dependencies: []
priority: low
type: enhancement
ordinal: 28000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
Ideas and problems arrive in five places.

**Source**
Gap G10, now pointing at the Backlog board instead of the Roadmap tab.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A 'Copy as ticket' action on contact messages, reports, suggestions and barn threads produces the ticket command or file
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Implementation Notes

<!-- SECTION:NOTES:BEGIN -->
Copy as ticket on Mailbox messages, report cards, Registry suggestions and (for the site owner) barn threads. src/lib/admin/ticketDraft.ts builds the backlog command; scrubs emails and phone numbers; never private-message words or the reporter. Also closed G9's last part: account deletions ring the owner's bell.
<!-- SECTION:NOTES:END -->
