---
id: MHH-065
title: 'Security: dependencies with known vulnerabilities updated'
status: Done
assignee: []
created_date: '2026-10-15 22:34'
updated_date: '2026-10-15 23:11'
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
- [x] #1 next updated to a patched 16.x and the site builds
- [x] #2 npm audit fix applied for non-breaking fixes
- [x] #3 shadcn moved to devDependencies
- [x] #4 xlsx replaced or confined to a safe use
- [x] #5 CI fails on critical advisories
<!-- AC:END -->

## Definition of Done
<!-- DOD:BEGIN -->
- [ ] #1 Tests pass (pre-commit)
- [ ] #2 Decision recorded in docs/DECISIONS.md if one was made
- [ ] #3 Member who reported it has a drafted reply, if any
<!-- DOD:END -->

## Final Summary

<!-- SECTION:FINAL_SUMMARY:BEGIN -->
next 16.1.6 → 16.3.8 (fixes 30+ advisories incl. proxy bypass, Server Actions CSRF, two RCEs; 16.3.8 chosen over today's 16.4.2 for settling time). npm audit fix for transitive; shadcn moved to devDependencies (build-time CSS only); xlsx → SheetJS's official fixed 0.20.3 build from cdn.sheetjs.com. Production audit: 0 vulnerabilities; CI fails on critical. Next 16.3 type-checks every tsconfig file during build, so next.config points the build at tsconfig.typecheck.json (app code; test-file errors ticketed). Built locally (386 pages) and passed the smoke test against the built site.
<!-- SECTION:FINAL_SUMMARY:END -->
