---
description: "V44 Visual QA Phase 6 — Mobile & Simple Mode Cross-Check. Playwright device tests + manual sweep protocol with numbered checklist for real iPhone/Android in Simple Mode."
---

# V44 Visual QA — Phase 6: Mobile & Simple Mode Cross-Check

> **Epic:** V44 Site-Wide Visual QA Audit
> **Goal:** Verify all Phase 1–5 fixes hold on real mobile viewports and under Simple Mode's 130% font scaling. This is the integration test for everything we've fixed.
> **Prerequisite:** Phases 1–5 complete.

**MANDATORY:** Read `.agents/MASTER_BLUEPRINT.md` and `.agents/MASTER_SUPABASE.md` first. All Iron Laws and guardrails apply.

// turbo-all

---

## Pre-flight

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

Start local dev server for testing:

```
cd c:\Project Equispace\model-horse-hub && npm run dev
```

---

## Task 6.1: Run existing Playwright device layout tests

```
cd c:\Project Equispace\model-horse-hub && npx playwright test e2e/device-layout.spec.ts --reporter=list
```

All existing tests must pass. If any fail, fix before proceeding.

---

## Task 6.2: Run existing accessibility tests

```
cd c:\Project Equispace\model-horse-hub && npx playwright test e2e/accessibility.spec.ts --reporter=list
```

All existing tests must pass.

---

## Task 6.3: Automated 375px sweep — Tier 1 pages

Create a new test file `e2e/visual-qa-mobile.spec.ts` that visits each Tier 1 page at 375×812 (iPhone SE) and checks:
- No horizontal scrollbar (`document.documentElement.scrollWidth <= window.innerWidth`)
- No content clipped off-screen
- Page loads without console errors

**Tier 1 pages to test (12 pages):**
```typescript
const tier1Pages = [
  '/dashboard',
  '/add-horse',
  '/stable/[testHorseId]',
  '/stable/[testHorseId]/edit',
  '/community/[testHorseId]',
  '/inbox',
  '/market',
  '/settings',
  '/catalog',
  '/profile/[testAlias]',
  '/notifications',
  '/feed',
];
```

Use test account credentials. Replace `[testHorseId]` and `[testAlias]` with real test data IDs.

```
cd c:\Project Equispace\model-horse-hub && npx playwright test e2e/visual-qa-mobile.spec.ts --reporter=list
```

---

## Task 6.4: Simple Mode automated check

Extend `e2e/visual-qa-mobile.spec.ts` with a test suite that:
1. Enables Simple Mode via settings (or by setting `data-simple-mode` attribute directly)
2. Visits each Tier 1 page
3. Checks no horizontal overflow at 375px with 130% text scale
4. Verifies all interactive elements have minimum 44×44px touch targets

```
cd c:\Project Equispace\model-horse-hub && npx playwright test e2e/visual-qa-mobile.spec.ts --reporter=list
```

---

## Task 6.5: Manual Mobile Sweep Protocol

> This checklist is for a human tester on a real device. Print or open on desktop while testing on phone.

### Device: iPhone (Safari) or Android (Chrome) — Simple Mode ON

**Instructions:** Enable Simple Mode in Settings first. Then visit each page and check.

#### Checklist A — Navigation & Layout (5 min)

| # | Page | Check | Pass? |
|---|------|-------|-------|
| 1 | `/` | Hero image loads, CTA buttons tappable | |
| 2 | `/login` | Email + password fields visible, keyboard doesn't hide submit | |
| 3 | `/dashboard` | All cards visible, no horizontal scroll, action buttons tappable | |
| 4 | `/add-horse` | Category toggles all visible, step indicator readable | |
| 5 | Header nav | Hamburger menu opens, all links reachable | |

#### Checklist B — Forms (10 min)

| # | Page | Action | Check | Pass? |
|---|------|--------|-------|-------|
| 6 | `/add-horse` | Tap "Model Horse", go to Step 3 | All selects have labels, values readable when closed | |
| 7 | `/add-horse` | Select Finish Type | Dropdown opens without clipping, items tappable | |
| 8 | `/settings` | Scroll to currency select | Selected value readable | |
| 9 | `/market` | Tap filter selects | Filter bar wraps, doesn't overflow | |
| 10 | `/inbox/[id]` | Type a message | Input visible above keyboard, send button reachable | |

#### Checklist C — Data Display (5 min)

| # | Page | Check | Pass? |
|---|------|-------|-------|
| 11 | `/dashboard` | StableGrid cards show badges clearly | |
| 12 | `/stable/[id]` | Long model name wraps, doesn't overflow | |
| 13 | `/community/[id]` | Photo gallery swipeable, lightbox opens | |
| 14 | `/catalog` | Items list scrollable, sidebar below main content | |
| 15 | `/shows/[id]/results` | Results readable, podium clear | |

#### Checklist D — Modals (5 min)

| # | Page | Action | Check | Pass? |
|---|------|--------|-------|-------|
| 16 | `/community/[id]` | Tap photo | Lightbox opens, close button visible, swipe works | |
| 17 | `/stable/[id]` | Tap "Transfer" | Modal content not clipped, PIN input visible | |
| 18 | Any modal | Press hardware back | Modal dismisses (not page navigation) | |

#### Checklist E — Simple Mode Specifics (5 min)

| # | Check | Pass? |
|---|-------|-------|
| 19 | All body text is visibly larger (130%) | |
| 20 | No text overlaps other text anywhere | |
| 21 | All buttons are larger and easier to tap | |
| 22 | Select dropdown items are tappable without mis-taps | |
| 23 | Badge text is still readable at larger size | |

**Record failures** with screenshot + page route + description. Create GitHub issues or add to `visual-qa-checklist.md`.

---

## Task 6.6: Fix any issues found

Apply fixes from automated tests and manual sweep. Build after each fix.

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Task 6.7: Commit

```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "fix(v44): phase 6 — mobile + Simple Mode cross-check, new Playwright visual-qa-mobile spec + manual sweep fixes"
```

---

## ✅ DONE Protocol

- [ ] All existing Playwright device-layout tests pass
- [ ] All existing accessibility tests pass
- [ ] New `visual-qa-mobile.spec.ts` passes (12 Tier 1 pages at 375px)
- [ ] Simple Mode tests pass (no overflow at 130%)
- [ ] Manual sweep checklist completed (23 items)
- [ ] All found issues fixed and verified
- [ ] Build passes, committed

**Next:** Run `/v44-visual-qa-phase7-signoff-automation`
