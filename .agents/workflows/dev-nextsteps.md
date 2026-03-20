---
description: Living task queue of dev cleanup, polish, and next-steps items. Run this workflow to pick up and execute pending work items.
---

# Dev Next-Steps — Living Task Queue

> **Purpose:** A persistent, prioritized list of cleanup, polish, and improvement tasks. Run `/dev-nextsteps` to pick up the next batch of work.
> **Last Updated:** 2026-03-19
> **Convention:** Mark items ✅ when done. Add new items at the bottom of the appropriate priority section. Commit this file alongside the code changes.

// turbo-all

## How to Use This Workflow

1. Read this entire file to understand pending tasks
2. Start with 🔴 Critical items first, then 🟡 Medium, then 🟢 Nice-to-Have
3. Each task has clear instructions — follow them exactly
4. After completing a task, mark it ✅ in this file
5. Run `npm run build` after each task to verify nothing broke
6. Commit with a descriptive message after completing a batch of related tasks

---

## Pre-flight

Verify the current build is clean:

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

Check recent git history for context:

```
cd c:\Project Equispace\model-horse-hub && git log --oneline -10
```

---

# ═══════════════════════════════════════
# COMPLETED SPRINTS (archived)
# ═══════════════════════════════════════

## ✅ Options 10-12: Beta feedback rounds + Supabase advisor fixes — DONE
## ✅ Option 13 (PS-1 through PS-5): Polish Sprint — Mobile, Password, Pagination, Admin — DONE
## ✅ V16: Integrity Sprint — batch import, Blue Book pipeline, SEO, serverless safety — DONE
## ✅ V17: Hobby-Native UX — binder view, bulk ops, rapid intake, photo reorder, privacy — DONE
## ✅ V18: Pro Dashboard & UI glow-up — DONE
## ✅ V19: Group Enrichment — files/docs, admin panel, pinned posts — DONE
## ✅ V20: CSS Architecture Maturity — module extraction — DONE
## ✅ V21: Feed Quality — watermarking, no-photo-no-feed — DONE
## ✅ V22: Commerce Engine — safe-trade state machine — DONE
## ✅ V23: Deep Polish — commerce escape hatches, Blue Book finish split, crypto PIN — DONE
## ✅ V24: Trust & Scale — verified provenance, Blue Book resin blanks, commerce rug-pull lock — DONE
## ✅ V25: Launch Readiness — WebSocket fix, Art Studio link, expired transfer unpark, expert-judged shows — DONE
## ✅ V26: Masterclass Sprint — 15 directives across data integrity, infra, commerce, UX — DONE
## ✅ V27: QA Sprint — 13 fixes, SEO, legal pages, footer, DM context cards — DONE
## ✅ Header Priority+ Navigation — progressive collapse nav for desktop — DONE
## ✅ Reference Link Bug Fix — finish type dropdown was resetting catalog_id — DONE
## ✅ Delete Modal Portal — createPortal to document.body for viewport centering — DONE
## ✅ V34: Show Polish & Realism Sprint — entry preview, smart class browser, results podium, personalized notifications, show history widget, expert judging precedence, cron auto-transition, host override, enriched show records, judge notes — DONE
## ✅ V34/P4: Playwright E2E Show Tests — 16 tests (9 pass, 7 graceful skip), .env.local loading, show listing / detail / entry form / podium / override / mobile / auth guard — DONE
## ✅ Judge Notes Fix — wired judge notes textarea through to show_records.judge_notes (was UI-only, never persisted) — DONE
## ✅ Notification Deep-Links — added link_url column (migration 096), all notifications now click through to referenced item instead of actor profile — DONE

---

# ═══════════════════════════════════════
# CURRENT QUEUE
# ═══════════════════════════════════════

# 🔴 Priority: Critical

## ✅ Task C-1: Clean Up Test Horses from Database — DONE (deleted Test, Test Horse, Test 2, cm bug)

**Why:** During the reference link bug investigation, several test horses were created with null catalog_id values ("Test Horse Bug", "Test Horse Bug 2", "Debug Ref Test", "Test Fix Verify", "AlboRef Test"). These should be removed.

**How:**
1. Navigate to `/dashboard` and delete these test horses via the UI
2. Or use Supabase dashboard to delete from `user_horses` where `custom_name` IN ('Test Horse Bug', 'Test Horse Bug 2', 'Debug Ref Test', 'Test Fix Verify', 'AlboRef Test')

---

## ✅ Task C-2: Audit Other Modals for Portal Pattern — DONE (SuggestEditModal was the only one missing createPortal; now fixed)

**Why:** The delete modal had a centering bug because it was nested inside elements with CSS transforms. Other modals may have the same issue.

**How:**
1. Search for all `modal-overlay` usage in `.tsx` files:
   ```
   cd c:\Project Equispace\model-horse-hub && Select-String -Path "src\components\*.tsx" -Pattern "modal-overlay" | Select-Object Filename
   ```
2. For each modal component found, check if it uses `createPortal(overlay, document.body)`
3. If not, add `import { createPortal } from "react-dom"` and wrap the modal overlay in `createPortal(..., document.body)`
4. Build and verify each change

---

## ✅ Task C-3: Deduplicate .modal-overlay CSS Definitions — DONE (already unified; only 1 canonical definition at z-index 1000)

**Why:** There are 3 separate `.modal-overlay` definitions in `globals.css` (lines ~2338, ~3498, ~10034) with different z-index values and slightly different styles. The last one wins due to CSS cascade, which has the lowest z-index (200).

**How:**
1. Audit all three definitions and unify into a single canonical `.modal-overlay` rule
2. Use the highest z-index (1000) and include padding for safe area
3. Remove the duplicate definitions
4. Build and test that all modals still render correctly

---

# 🟡 Priority: Medium

## Task M-1: globals.css Continued Extraction

**Why:** `globals.css` is still ~11,000 lines. The V20 CSS module extraction was partial. More page-level and component-level styles should be extracted to CSS Modules.

**Time:** Ongoing, do in batches

**How:**
1. Identify the largest remaining style blocks in `globals.css`
2. Extract to `.module.css` files alongside their components
3. Update component imports to use the CSS module
4. Verify no regressions with `npx next build`

---

## ✅ Task M-2: Comprehensive Passport Portal Audit — DONE (TransferModal already uses createPortal; ParkedExportPanel is inline, not a modal)

**Why:** The passport page (`/stable/[id]`) renders multiple modals (Delete, Transfer, Parked Export). All should use the portal pattern.

**How:**
1. Check `TransferModal.tsx`, `ParkedExportPanel.tsx` for portal usage
2. Apply the same `createPortal` pattern if missing
3. Test by scrolling to the bottom of a passport page and triggering each modal

---

## ✅ Task M-3: Review UnifiedReferenceSearch Release Panel UX — DONE (code review verified: mold click pre-selects immediately, releases panel shows for drill-down, override works correctly)

**Why:** The fix to `handleMoldClick` now pre-selects the mold immediately. For molds with many releases, the releases panel may not be visible since `selectedCatalogId` is now truthy and the display switches to the "selected" badge (we added `releases.length === 0` check). Verify that:
- Molds with releases still show the releases panel for drill-down
- Molds without releases correctly show the selected badge
- Users can override a mold selection by picking a specific release

**How:**
1. Test with a mold that has multiple releases (search for "Ideal" or "Stablemate" in the catalog)
2. Verify the releases panel appears after clicking the mold
3. Verify picking a release overrides the mold selection
4. Verify proceeding without picking a release still saves the mold correctly

---

# 🟢 Priority: Nice-to-Have

## Task N-1: Landing Page Refresh

**Why:** The landing page (`src/app/page.tsx`) could benefit from updated imagery and a more compelling value proposition now that the platform has grown substantially.

---

## Task N-2: Performance Audit

**Why:** With 70 migrations and growing data, query performance on pages like `/dashboard` and `/feed` should be monitored.

**How:**
1. Run Lighthouse on key pages
2. Check Supabase dashboard for slow queries
3. Consider adding database indexes for frequent query patterns

---

## Task N-3: Accessibility Audit

**Why:** Color contrast, keyboard navigation, and screen reader support should be verified for WCAG 2.1 AA compliance.

**How:**
1. Run axe-core or Lighthouse accessibility audit
2. Fix high-impact issues (missing alt text, low contrast, missing ARIA labels)
3. Test keyboard-only navigation through the add-horse flow

---

# ═══════════════════════════════════════
# SIGN-OFF CHECKLIST
# ═══════════════════════════════════════

After completing a batch, verify:

- [ ] All targeted tasks marked ✅
- [ ] `npx next build` passes cleanly
- [ ] Changes committed with descriptive message
- [ ] This file updated and committed alongside code changes

Final build check:
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

Push:
```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "chore: update dev-nextsteps with completed tasks" && git push
```
