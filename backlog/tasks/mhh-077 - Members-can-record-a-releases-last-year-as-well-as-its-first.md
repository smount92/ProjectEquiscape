---
id: MHH-077
title: Members can record a release's last year as well as its first
status: Done
assignee: []
created_date: '2026-10-16 21:25'
updated_date: '2026-10-16 22:24'
labels:
  - registry
  - member-reported
milestone: m-3
dependencies: []
priority: medium
type: enhancement
ordinal: 77000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
Only a first year can be filed. Add my release silently drops an end year (parseInt of 1995-1997 keeps 1995), and a start-only year shows as 1998- in the linker.

**Source**
A volunteer cataloguing Breyer Stablemates, 2026-10-15/16; causes verified by two read-only investigations.

**Notes**
parseYearRange in src/lib/catalog/corrections.ts; one yearRangeLabel for the reference page chip, the linker and cards.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [x] #1 parseYearRange accepts 1995, 1995-1997, 1995–97, 1995 - 1997 and 1995 to 1997, and rejects end before start and years out of range
- [x] #2 Fill in what you know and Add my release write release_year_start and release_year_end
- [x] #3 The new-entry form has a Last year (if it ended) field and the approval stores it
- [x] #4 Every year display uses one yearRangeLabel; a start-only year shows as 1998
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
parseYearRange() in lib/catalog/corrections.ts reads 1995, 1995-1997, 1995–97, 1995 - 1997, 1995 to 1997 (a two-digit end takes the start's century: 1998-02 is 2002) and refuses an end before the start and years outside 1900..next year+2, in words. The linker's 'fill in what you know' files release_year_start and release_year_end (yearFactChanges); 'Add my release' sends year and year_end and refuses a year it cannot read (it used to parseInt '1995-1997' to 1995); both hints read 'e.g. 1976 or 1995-1997'. The new-entry form has 'Last year (if it ended)' (checked as one range) and approval stores release_year_end via additionYears(). Years display through cardDisplay.yearRangeLabel everywhere: the reference page chip and description, the linker, cards, the old picker (releaseYears) and the three passports; a start-only year reads '1998' (6,929 live rows have only a first year and showed '1998–' in the linker and old picker). The Silver fast path already accepts release_year_end.
<!-- SECTION:FINAL_SUMMARY:END -->
