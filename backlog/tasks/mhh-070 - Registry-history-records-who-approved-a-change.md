---
id: MHH-070
title: Registry history records who approved a change
status: Done
assignee: []
created_date: '2026-10-16 00:44'
updated_date: '2026-10-16 00:57'
labels:
  - registry
  - admin
milestone: m-2
dependencies: []
priority: high
type: bug
ordinal: 70000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
applyApprovedSuggestion writes the contributor into catalog_changelog.approved_by, not the person who approved; merges approved from duplicate reports record the wrong actor too. The history can't say who decided anything, which matters before anyone besides the owner approves (Registry moderators).

**Source**
Registry moderator design research (2026-10-15), docs/design/registry-moderators.md.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 approved_by is the approver (owner, or the curator rank for auto-approvals)
- [x] #2 Merges from duplicate reports record the approver
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
applyApprovedSuggestion takes the approver: reviewSuggestion passes the owner, auto-approval passes the contributor (their rank applied it). Duplicate-report merges record contributed_by = reporter and approved_by = approver. Test in merge.test.ts.
<!-- SECTION:FINAL_SUMMARY:END -->
