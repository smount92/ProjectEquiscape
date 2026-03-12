---
description: "Phase 6 Epic 2 — CSS Architecture Maturity. Extract the 11,643-line globals.css monolith into CSS Modules. Iterative, zero-regression migration in 4 phases."
---

# Phase 6 — Epic 2: CSS Architecture Maturity (The Rewrite)

> **Master Blueprint:** `docs/Phase6_Master_Blueprint.md` — Epic 2
> **Philosophy:** "Right, not fast." We dismantle the monolith iteratively — 3-4 components per batch, build-verify after each.
> **The Problem:** `src/app/globals.css` is **11,643 lines** and **254 KB**. It's a hallucination hazard for AI agents, impossible to reason about, and any change risks unintended regressions across the entire app.
> **The Goal:** Strip globals.css to ONLY `:root` tokens + base HTML resets (~200 lines). Everything else moves into co-located CSS Modules.

// turbo-all

---

## Developer Agent Rules

> **MANDATORY:**
> 1. Add `✅ DONE` and the date after each phase heading when complete
> 2. Run `npx next build` after every batch (3-4 components)
> 3. **ZERO visual regressions.** Open the affected page at 1440px AND 375px after each batch
> 4. Never delete a class from globals.css until its replacement CSS Module is verified
> 5. Use `import styles from './ComponentName.module.css'` and `className={styles.className}` pattern
> 6. When a component uses design tokens, reference them as `var(--color-text-primary)` inside the module — CSS custom properties work in modules

---

## Architecture Overview

### Before (Current State)
```
src/app/globals.css          ← 11,643 lines, ALL styles
src/app/competition.css      ← page-specific (already extracted)
src/app/studio.css           ← page-specific (already extracted)
src/components/*.tsx          ← all use global className strings
```

### After (Target State)
```
src/app/globals.css           ← ~200-300 lines: :root tokens, base resets, utility classes
src/app/competition.css       ← kept as-is
src/app/studio.css            ← kept as-is
src/components/StableGrid.tsx
src/components/StableGrid.module.css
src/components/UniversalFeed.tsx
src/components/UniversalFeed.module.css
...etc for all 79 components
src/app/dashboard/dashboard.module.css    ← page-level modules
src/app/community/community.module.css
...etc
```

---

## Phase 1 — Global Token Extraction (The Foundation)

**Goal:** Identify the boundary line. Everything above stays in globals, everything below gets extracted.

### Step 1: Audit globals.css section boundaries

The file roughly follows this structure:

| Line Range (Approx) | Content | Stays in globals? |
|---|---|---|
| 1-100 | `:root` design tokens (colors, spacing, typography, layout) | ✅ YES |
| 100-240 | Base resets (`*, body, a, h1-h6, img, input`) | ✅ YES |
| 240-300 | `.page-container`, `.auth-page`, layout utilities | ✅ YES (layout primitives) |
| 300-450 | `.btn`, `.btn-primary`, `.btn-ghost`, `.btn-lg` | ✅ YES (shared utility classes) |
| 450-650 | `.card`, `.text-gradient`, `.animate-*` | ✅ YES (shared utilities) |
| 650-900 | `.form-input`, `.form-select`, `.form-label`, `.form-group` | ✅ YES (form primitives) |
| 900-11643 | **EVERYTHING ELSE** — component-specific, page-specific, media queries | ❌ EXTRACT |

### Step 2: Mark the "extraction boundary" in globals.css

Add a clear comment at the boundary line:

```css
/* ══════════════════════════════════════════════════════════════
   END OF GLOBAL DESIGN SYSTEM
   Everything below this line is scheduled for extraction into
   CSS Modules. Do not add new styles below this boundary.
   ══════════════════════════════════════════════════════════════ */
```

### Step 3: Build and verify

Run `npx next build`. No changes to functionality — this is purely annotation.

---

## Phase 2 — Extract High-Impact Component Styles (Batch 1-3)

**Strategy:** Start with the largest, most self-contained components. Extract 3-4 per batch. Build + verify after each.

### Batch 1: Grid Components (~500 lines)

These are the biggest CSS consumers and most self-contained:

| Component | Current Classes | Target Module |
|---|---|---|
| `StableGrid.tsx` | `.stable-grid`, `.horse-card`, `.horse-card-image`, `.horse-card-details`, `.horse-card-badges` | `StableGrid.module.css` |
| `StableLedger.tsx` | `.stable-ledger`, `.ledger-row`, `.ledger-header` | `StableLedger.module.css` |
| `ShowRingGrid.tsx` (if exists) | `.show-ring-grid`, `.show-ring-card` | `ShowRingGrid.module.css` |

**Procedure for each component:**
1. Find all CSS rules in globals.css that match the component's class names
2. Copy them into `ComponentName.module.css` (removing the leading dot from selectors and converting to camelCase or keeping kebab-case with bracket notation)
3. Update the `.tsx` file: `import styles from './StableGrid.module.css'`
4. Replace `className="stable-grid"` with `className={styles.stableGrid}` (or `className={styles['stable-grid']}`)
5. **Do not delete from globals.css yet** — leave both in place temporarily
6. Build + test at 1440px and 375px
7. Once verified, add a `/* EXTRACTED → StableGrid.module.css */` comment in globals.css (don't delete until all batches done)

### Batch 2: Feed & Social Components (~400 lines)

| Component | Current Classes | Target Module |
|---|---|---|
| `UniversalFeed.tsx` | `.feed-post`, `.post-card`, `.post-header`, `.post-actions`, `.composer` | `UniversalFeed.module.css` |
| `RichEmbed.tsx` | `.rich-embed`, `.embed-card` | `RichEmbed.module.css` |
| `GroupDetailClient.tsx` | `.group-tabs`, `.group-channel-pill` | `GroupDetailClient.module.css` |
| `GroupFiles.tsx` | `.group-file-list`, `.group-file-item` | `GroupFiles.module.css` |

### Batch 3: Dashboard Components (~350 lines)

| Component | Current Classes | Target Module |
|---|---|---|
| `DashboardShell.tsx` | `.search-sort-bar`, `.view-toggle`, `.bulk-bar` | `DashboardShell.module.css` |
| `BulkOperationsBar.tsx` | `.bulk-operations-bar` | `BulkOperationsBar.module.css` |
| `NanDashboardWidget.tsx` | `.nan-widget`, `.nan-tracker` | `NanDashboardWidget.module.css` |
| `TransferHistorySection.tsx` | `.transfer-history` | `TransferHistorySection.module.css` |

---

## Phase 3 — Extract Page-Level Styles (Batch 4-6)

### Batch 4: Dashboard page

Create `src/app/dashboard/dashboard.module.css`:
- `.dashboard-layout`, `.dashboard-grid`, `.dashboard-main`, `.dashboard-sidebar`
- `.sidebar-section`, `.sidebar-section-title`, `.sidebar-stats`, `.sidebar-stat-row`
- `.sidebar-collections`, `.sidebar-collection-link`

### Batch 5: Community/Show Ring pages

Create `src/app/community/community.module.css`:
- Show Ring grid overrides, filter bars, voting UI

### Batch 6: Profile, Discover, Market pages

Create page-specific module files for each.

---

## Phase 4 — Cleanup & Verification

### Step 1: Remove extracted rules from globals.css

Go through every `/* EXTRACTED → ... */` comment and remove the original rules.

### Step 2: Consolidate media queries

Many media queries in globals.css contain rules for multiple components. After extraction, these may be partially empty. Clean up any media query blocks that are now empty.

### Step 3: Final line count verification

Target: globals.css should be **under 400 lines** after full extraction.

### Step 4: Full regression test

Open every major page at 1440px and 375px:
- [ ] Dashboard
- [ ] Feed
- [ ] Community (Show Ring)
- [ ] Discover
- [ ] Market
- [ ] Profile
- [ ] Group detail
- [ ] Add Horse form
- [ ] Inbox

---

## Completion Checklist

**Phase 1 — Token Extraction**
- [ ] Boundary comment added to globals.css
- [ ] Verified which sections stay vs extract
- [ ] `npx next build` passes

**Phase 2 — Component Extraction (Batches 1-3)**
- [ ] Batch 1: StableGrid, StableLedger, ShowRingGrid modules created
- [ ] Batch 2: UniversalFeed, RichEmbed, GroupDetailClient, GroupFiles modules created
- [ ] Batch 3: DashboardShell, BulkOperationsBar, NanDashboardWidget, TransferHistory modules created
- [ ] All batches: `npx next build` passes after each
- [ ] Visual check at 1440px + 375px after each batch

**Phase 3 — Page-Level Extraction (Batches 4-6)**
- [ ] Batch 4: Dashboard page module created
- [ ] Batch 5: Community page module created
- [ ] Batch 6: Profile, Discover, Market page modules created

**Phase 4 — Cleanup**
- [ ] All extracted rules removed from globals.css
- [ ] Empty media queries cleaned up
- [ ] globals.css under 400 lines
- [ ] Full regression test — all 9 pages verified

**Estimated effort:** ~12-16 hours across 4 phases (do NOT rush this)
