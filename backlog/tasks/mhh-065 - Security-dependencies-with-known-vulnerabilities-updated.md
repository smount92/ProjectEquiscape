---
id: MHH-065
title: 'Security: dependencies with known vulnerabilities updated'
status: To Do
assignee: []
created_date: '2026-10-15 22:34'
labels:
  - platform
milestone: m-0
dependencies: []
priority: high
type: bug
ordinal: 65000
---

## Description

<!-- SECTION:DESCRIPTION:BEGIN -->
**Why**
npm audit (production dependencies, 2026-10-15): 2 critical (next, proxy-addr) and 22 high. Next 16.1.6 has a critical advisory fixed in 16.4.2. xlsx (SheetJS on npm) has prototype-pollution and ReDoS advisories with no npm fix. shadcn (a CLI) sits in dependencies and pulls in several of the highs.

**Source**
Pipeline work, MHH-015.
<!-- SECTION:DESCRIPTION:END -->

## Acceptance Criteria
<!-- AC:BEGIN -->
- [ ] #1 next updated to a patched 16.x and the site builds
- [ ] #2 npm audit fix applied for non-breaking fixes
- [ ] #3 shadcn moved to devDependencies
- [ ] #4 xlsx replaced or confined to a safe use
- [ ] #5 CI fails on critical advisories
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->
