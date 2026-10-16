---
id: MHH-019
title: Report button on every kind of content
status: Done
assignee: []
created_date: '2026-10-15 22:19'
updated_date: '2026-10-16 01:00'
labels:
  - moderation
milestone: m-2
dependencies: []
priority: high
type: feature
ordinal: 19000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
Only horse pages can be reported. Posts, comments, profiles, DMs, listings, show entries, barn threads and Help ID cannot.

**Source**
Gap G1, docs/workflows/README.md.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 One Report component mounted on every content type the reports table accepts
- [x] #2 Reports land in Admin › Reports with the content type
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Tests pass (pre-commit)
- [x] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
One ReportButton (src/components/ReportButton.tsx): a small flag that opens an accessible dialog (labelled, focus inside, Escape closes, focus returns), radio reasons, optional details, never shown on your own content. Mounted on feed posts and replies (FeedPostCard, UniversalFeed), barn threads and replies (ThreadView), member profiles, private messages (DealThread), horses and their listings (passport; listing = horse, Q27), show entries (ClassRoomLineup) and Help ID requests and suggestions. Vocabulary in src/lib/moderation/reports.ts; submitReport validates with zod and returns plain words (log-in, duplicate, not-yet-switched-on). Migration 235 widens user_reports.target_type with show_entry, id_request, id_suggestion. Admin cards show the content type in words.
<!-- SECTION:FINAL_SUMMARY:END -->
