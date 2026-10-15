---
id: MHH-009
title: One result shape for server actions; no raw database errors shown to members
status: To Do
assignee: []
created_date: '2026-10-15 22:19'
labels:
  - platform
milestone: m-0
dependencies: []
priority: high
type: enhancement
ordinal: 9000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
13 files declare their own ActionResult; `error.message` is returned 296 times; `requireAuth()` is untyped and throws uncaught.

**Source**
docs/STANDARDS.md plan step 2.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 Shared ActionResult type and safeError() helper exist with tests
- [ ] #2 requireAuth returns SupabaseClient<Database>
- [ ] #3 A ratchet test counts raw error returns and raw getUser calls and only lets them fall
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->
