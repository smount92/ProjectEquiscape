---
description: "V44 Visual QA Phase 7 — Sign-off & Automation. Update checklist, add axe-core + contrast checker to CI, update dev-nextsteps, final build + Lighthouse accessibility ≥95."
---

# V44 Visual QA — Phase 7: Sign-off & Automation

> **Epic:** V44 Site-Wide Visual QA Audit
> **Goal:** Lock in all fixes with automated regression tests, update all living docs, and achieve Lighthouse accessibility ≥95.
> **Prerequisite:** Phases 0–6 complete.

**MANDATORY:** Read `.agents/MASTER_BLUEPRINT.md` and `.agents/MASTER_SUPABASE.md` first. All Iron Laws and guardrails apply.

// turbo-all

---

## Pre-flight

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

```
cd c:\Project Equispace\model-horse-hub && git log --oneline -10
```

---

## Task 7.1: Update `visual-qa-checklist.md` with results

**File:** `.agents/docs/visual-qa-checklist.md` (created in Phase 0)

Update the checklist with:
1. Mark every page as ✅ audited or ❌ skipped (with reason)
2. Add "Cold Palette Violations Fixed" count (from Phase 0 scan → Phase 1–5 fixes)
3. Add "Bare Native Elements Fixed" count
4. Add summary stats: total fixes applied per phase
5. Add date of completion

---

## Task 7.2: Extend `accessibility.spec.ts` with axe-core

**File:** `e2e/accessibility.spec.ts` (EXISTING — extend, don't replace)

Add axe-core checks to the existing spec. Install if needed:

```
cd c:\Project Equispace\model-horse-hub && npm install --save-dev @axe-core/playwright
```

Add tests that run axe-core on each Tier 1 page:

```typescript
import AxeBuilder from '@axe-core/playwright';

test('Tier 1 pages pass axe-core accessibility', async ({ page }) => {
  const tier1 = ['/dashboard', '/add-horse', '/market', '/catalog', '/settings', '/feed'];
  for (const route of tier1) {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa'])
      .analyze();
    expect(results.violations).toEqual([]);
  }
});
```

Adjust for auth requirements (use test account login helper).

```
cd c:\Project Equispace\model-horse-hub && npx playwright test e2e/accessibility.spec.ts --reporter=list
```

---

## Task 7.3: Add contrast checker to CI

**File:** `e2e/accessibility.spec.ts` (append)

Add a specific contrast check test:

```typescript
test('No contrast violations on key pages', async ({ page }) => {
  const pages = ['/dashboard', '/add-horse', '/stable/[testId]'];
  for (const route of pages) {
    await page.goto(route);
    const results = await new AxeBuilder({ page })
      .withRules(['color-contrast'])
      .analyze();
    expect(results.violations).toEqual([]);
  }
});
```

```
cd c:\Project Equispace\model-horse-hub && npx playwright test e2e/accessibility.spec.ts --reporter=list
```

---

## Task 7.4: Run Lighthouse accessibility audit

Run Lighthouse on the landing page and one authenticated page:

```
cd c:\Project Equispace\model-horse-hub && npx lighthouse http://localhost:3000 --only-categories=accessibility --output=json --output-path=.agents/docs/lighthouse-landing.json --chrome-flags="--headless --no-sandbox"
```

Check the score:

```
cd c:\Project Equispace\model-horse-hub && (Get-Content .agents/docs/lighthouse-landing.json | ConvertFrom-Json).categories.accessibility.score
```

**Target: ≥ 0.95 (95%)**

If below 95, the JSON output will list specific failing audits. Fix them and re-run.

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Task 7.5: Run full test suite

```
cd c:\Project Equispace\model-horse-hub && npx vitest run
```

```
cd c:\Project Equispace\model-horse-hub && npx playwright test --reporter=list
```

All tests must pass — unit, integration, AND the new visual QA specs.

---

## Task 7.6: Update `dev-nextsteps.md`

**File:** `.agents/workflows/dev-nextsteps.md`

Add completed entry:

```markdown
## ✅ V44 Visual QA Audit — DONE (YYYY-MM-DD)

**Workflow:** `.agents/workflows/v44-visual-qa-phase0-inventory.md` through `phase7-signoff-automation.md`
**Source:** Ongoing beta feedback — one-off UI inconsistencies across forms, tables, mobile
**Scope:** 8 phases, 63 pages audited, 149 components checked
**Phases completed:**
1. ✅ Phase 0: Surface inventory (63 pages tiered, cold palette violations cataloged)
2. ✅ Phase 1: shadcn primitives audit (11 components, warm palette + WCAG fixes)
3. ✅ Phase 2: Forms & dropdowns (15 form surfaces, label visibility + select readability)
4. ✅ Phase 3: Tables & grids (12 data surfaces, overflow wrappers + alignment)
5. ✅ Phase 4: Text sections (11 text-heavy surfaces, heading hierarchy + overflow-wrap)
6. ✅ Phase 5: Modals & lightboxes (7 overlay components, content clipping + close buttons)
7. ✅ Phase 6: Mobile + Simple Mode (Playwright mobile spec + 23-item manual checklist)
8. ✅ Phase 7: Sign-off (axe-core in CI, Lighthouse ≥95, all tests pass)
**Status:** ✅ COMPLETE
```

---

## Task 7.7: Update `MASTER_BLUEPRINT.md`

**File:** `.agents/MASTER_BLUEPRINT.md`

Add V44 to the completed sprints section:

```markdown
### V44 Sprint: ✅ COMPLETE (YYYY-MM-DD)
- [x] Site-wide Visual QA across 63 pages and 149 components
- [x] shadcn primitive palette + WCAG hardening
- [x] Form label visibility and select readability audit
- [x] axe-core + contrast checker in Playwright CI
- [x] Lighthouse accessibility ≥95
```

---

## Task 7.8: Update `onboard.md` metrics

**File:** `.agents/workflows/onboard.md`

Update component count, Playwright spec count, and any other metrics that changed during the audit.

---

## Task 7.9: Final commit and push

```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "chore(v44): phase 7 — sign-off, axe-core CI, Lighthouse 95+, all docs updated"
```

```
cd c:\Project Equispace\model-horse-hub && git push
```

---

## ✅ DONE Protocol — ENTIRE V44 EPIC

Mark the V44 Visual QA epic complete when:
- [ ] All 8 phase workflows executed (Phase 0–7)
- [ ] `visual-qa-checklist.md` shows all Tier 1+2 pages as ✅ audited
- [ ] `visual-qa-surface-inventory.json` has real data
- [ ] No `bg-white` or `bg-stone-50` in any `ui/` primitive
- [ ] Every `<select>` has a visible `<label>`
- [ ] Every table has `overflow-x-auto` on mobile
- [ ] Every modal content fits within 90dvh
- [ ] axe-core passes on all Tier 1 pages (0 violations)
- [ ] Lighthouse accessibility ≥ 95%
- [ ] All Playwright + Vitest tests pass
- [ ] `dev-nextsteps.md` updated
- [ ] `MASTER_BLUEPRINT.md` updated
- [ ] `onboard.md` metrics updated
- [ ] Pushed to git

**🎉 V44 Visual QA Audit is complete. Beta users should stop finding one-off issues.**
