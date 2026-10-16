---
id: MHH-092
title: >-
  Every Registry change goes through one writer, named in the history and
  undoable for 30 days
status: Done
assignee: []
created_date: '2026-10-16 23:31'
updated_date: '2026-10-16 23:36'
labels:
  - registry
milestone: m-3
dependencies: []
priority: high
type: enhancement
ordinal: 82000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why** Registry writes sat in four files with four ideas of the rules; approvals recorded the contributor as the approver; merges could not be undone. **Source** docs/design/registry-desk-phase1-plan.md (Package A, section 3 single writer); design doc docs/design/registry-moderators.md section 5. **Notes** src/lib/catalog/write.ts (validateChanges, updateItem, insertItem, revertFields, requestMerge/confirmMerge/declineMerge, removeItem, undoAction, linkCounts); src/lib/catalog/suggestionApply.ts (applySuggestion, decideSuggestion); src/lib/registry/{types,limits,alerts}.ts; migration 243 (catalog_removed_items, registry_merge/unmerge/remove/restore); guard test src/__tests__/registry-single-writer.test.ts; changelog page no longer links removed entries to /catalog/null.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 Only src/lib/catalog/write.ts writes catalog_items or catalog_changelog, and a test fails otherwise
- [x] #2 Every value is checked in words; a re-filed release takes its mold's scale; a save over someone else's is refused with the current row
- [x] #3 A moderator's merge waits for a second look from someone else; the owner's applies at once; both can be undone for 30 days once 243 is in
- [x] #4 A row anything points at (horses, want lists, releases, set pieces, suggestions, sales, flags) can't be removed; an unlinked one can, and comes back on undo
- [x] #5 Moderators are held to 300 edits, 20 merges, 50 removals and 10 rule proposals a day; the owner is exempt; limits and the speed alarm tell the owner
- [x] #6 Before 242 and 243 are pasted the owner's queue, approvals and merges work as before
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [x] #1 Tests pass (pre-commit)
- [x] #2 Decision recorded in docs/DECISIONS.md if one was made
- [x] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Branch desk-a-engine: src/lib/catalog/write.ts (the only Registry writer, guard test), suggestionApply.ts, src/lib/registry/{types,limits,alerts}.ts, migration 243, write sites in merge.ts / admin.ts / catalog-suggestions.ts moved, changelog page no longer links removed entries. Deviations listed at the end of docs/design/registry-desk-phase1-plan.md.
<!-- SECTION:FINAL_SUMMARY:END -->
