---
id: MHH-089
title: Registry moderators clear the suggestion Queue on the Registry Desk
status: Done
assignee: []
created_date: '2026-10-16 23:28'
updated_date: '2026-10-16 23:28'
labels:
  - registry
milestone: m-3
dependencies: []
priority: medium
type: feature
ordinal: 86000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why** Every Registry suggestion waits for the owner: about 150 decisions a week by hand. Vetted moderators need their own place to approve, fix and approve, or say no, without /admin (DECISIONS Q6). **Source** Owner rulings 2026-10-16; docs/design/registry-moderators.md; docs/design/registry-desk-phase1-plan.md Package B; approved mock https://claude.ai/artifact/BQuj11HRaMuYDfEy8succo. **Notes** /catalog/desk (layout, Queue page), src/app/actions/registry-desk.ts, src/components/desk/ (DeskTabs, DeskLink, QueueList, QueueItemCard, EditThenApprove). Writes go through Package A's write.ts and suggestionApply.ts.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Only moderators and the owner reach /catalog/desk; everyone else gets not-found, and every Desk action refuses them
- [x] #2 The Queue shows corrections, new entries, duplicates, what curators applied this week, and merges waiting for a second look, oldest first
- [x] #3 Opening Edit then approve holds the suggestion for 30 minutes; another moderator sees who has it; an expired hold is free
- [x] #4 Nobody approves or rejects their own suggestion; saying no needs a reason of 5 letters or more
- [x] #5 The Registry masthead shows a Registry Desk link only to moderators and the owner
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Tests pass (pre-commit)
- [x] #2 Decision recorded in docs/DECISIONS.md if one was made
- [x] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Built on branch desk-b-ui (Package B of Registry Desk Phase 1): /catalog/desk layout and Queue page, src/app/actions/registry-desk.ts (every export gated by requireRegistryModerator, ActionResult), QueueList, QueueItemCard, EditThenApprove, DeskTabs, DeskLink in CatalogMasthead. Tests: registry-desk.test.ts, QueueItemCard.test.tsx. Works for real once Package A (role check, write.ts, suggestionApply.ts) replaces the placeholders at merge; until then nobody passes the role check. No Playwright look-see (no local moderator login).
<!-- SECTION:FINAL_SUMMARY:END -->
