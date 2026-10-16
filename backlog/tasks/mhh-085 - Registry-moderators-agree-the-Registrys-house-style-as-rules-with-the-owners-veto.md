---
id: MHH-085
title: >-
  Registry moderators agree the Registry's house style as rules, with the
  owner's veto
status: Done
assignee: []
created_date: '2026-10-16 23:20'
updated_date: '2026-10-16 23:25'
labels:
  - registry
milestone: m-3
dependencies: []
priority: medium
type: feature
ordinal: 82000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why** Style questions (set titles, auction rows, generation tags) were owner rulings plus bulk repairs; the owner ruled the moderators write them. **Source** DECISIONS 2026-10-16 (Registry style rules); plan owner answer 2 (3 agreements, the owner's counts, the proposer's doesn't; veto any time). **Notes** src/lib/registry/rules.ts, fixes.ts; /catalog/desk/rules; migration 244 (registry_style_rules, registry_rule_votes).
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 A rule takes effect at 3 agreements; the proposer's doesn't count; the owner's does
- [x] #2 Only the owner can veto (any time) or retire a rule
- [x] #3 A suggested fix is offered only while a rule naming it is in effect, and every fix passes the Registry writer's checks
- [x] #4 Up to 10 proposals a day per moderator; the owner is exempt
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
Package C (b7c4e60f, a8490e85). rules.ts: AGREEMENTS_NEEDED 3, the proposer doesn't count, the owner's agreement does; votes move only a proposed rule (guarded update). Owner-only vetoRule (proposed or in effect, with a note) and retireRule. fixes.ts: 8 suggested fixes (number out of title, stray punctuation, capital, years as numbers, shop or sale to run details, description to notes, colour out of title, set-piece title), offered only while a rule naming them is in effect; fixes.test.ts runs each through write.ts validateChanges. /catalog/desk/rules with the proposal form; 10 proposals a day, owner exempt. Tables in migration 244.
<!-- SECTION:FINAL_SUMMARY:END -->
