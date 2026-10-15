---
id: MHH-009
title: One result shape for server actions; no raw database errors shown to members
status: Done
assignee: []
created_date: '2026-10-15 22:19'
updated_date: '2026-10-15 23:23'
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
- [x] #1 Shared ActionResult type and safeError() helper exist with tests
- [x] #2 requireAuth returns SupabaseClient<Database>
- [x] #3 A ratchet test counts raw error returns and raw getUser calls and only lets them fall
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
src/lib/actions/result.ts: shared ActionResult, safeError (logs the real error, returns plain words), fail, NOT_LOGGED_IN, GENERIC_FAILURE. requireAuth/optionalAuth now return SupabaseClient<Database>: 15 places the typed client flagged are fixed (one was a call to an increment_count function that does not exist; the fallback always ran and is now the only path). action-standards.test.ts ratchets raw error.message returns (364), raw auth.getUser() (63) and local ActionResult copies (13). lib/supabase/admin.ts carries import 'server-only' (vitest maps it to an empty stub). Converting files happens as they are touched.
<!-- SECTION:FINAL_SUMMARY:END -->
