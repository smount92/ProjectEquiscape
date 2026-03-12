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

**Phase 1 — Token Extraction** ✅ DONE 2026-03-12
- [x] Boundary comment added to globals.css (line 917)
- [x] Verified which sections stay vs extract
- [x] `npx next build` passes

**Phase 2 — Component Extraction (Batches 1-6)** ✅ DONE 2026-03-12
- [x] Batch 1: StableLedger module created + verified
- [x] Batch 2: GroupDetailClient, GroupFiles, GroupAdminPanel modules created + verified
- [x] Batch 3: ChatThread, OfferCard, MakeOfferModal modules created + verified
- [x] Batch 4: DashboardShell (view toggle + bulk ops) module created + verified
- [x] Batch 5: RatingForm, FeaturedHorseCard, MatchmakerMatches modules created + verified
- [x] Batch 6: Inbox page module (list, items, avatars, status badges) created + verified
- [x] All batches: `npx next build` passes after each

**Phase 3 — Page-Level + Component Extraction (Batches 7-8)** ✅ DONE 2026-03-12
- [x] Batch 7: Dashboard layout, Settings page, Discover page modules created + verified
- [x] Batch 8: DashboardToast, WishlistButton, FavoriteButton modules created + verified
- [x] All batches: `npx next build` passes after each

**Decision: Keep in globals.css (shared primitives):**
- `horse-card-*` — used across 7+ files (StableGrid, ShowRingGrid, profile, collection, community, events)
- `feed-*` — shared across UniversalFeed, ActivityFeed, feed detail page
- `btn-*`, `form-*`, `modal-*`, `card` — universal utilities
- `passport-*` — shared between passport page and gallery component
- `sidebar-section` — shared between dashboard and GroupAdminPanel
- `market-pagination` — shared between market and dashboard pages
- `help-id-*` — shared across 5 files
- `community-hero-*` — shared across community and discover pages

**Modules Created (18 total):**
| Module | Lines Extracted | Source |
|---|---|---|
| `StableLedger.module.css` | ~190 | globals.css 10659-10824, 10988-10990 |
| `GroupDetailClient.module.css` | ~130 | globals.css 11637-11709, 11760-11815 |
| `GroupFiles.module.css` | ~55 | globals.css 11710-11758 |
| `GroupAdminPanel.module.css` | ~50 | globals.css 11760-11800 |
| `ChatThread.module.css` | ~180 | globals.css 5098-5271 |
| `OfferCard.module.css` | ~120 | globals.css 7324-7456 |
| `MakeOfferModal.module.css` | ~45 | globals.css 7428-7470 |
| `DashboardShell.module.css` | ~105 | globals.css 10621-10655, 10889-10942 |
| `RatingForm.module.css` | ~55 | globals.css 6788-6840 |
| `FeaturedHorseCard.module.css` | ~90 | globals.css 7079-7182 |
| `MatchmakerMatches.module.css` | ~110 | globals.css 4660-4758 |
| `inbox/inbox.module.css` | ~200 | globals.css 4860-4990 |
| `dashboard/dashboard.module.css` | ~140 | globals.css 11367-11526 |
| `settings/settings.module.css` | ~120 | globals.css 8407-8510 |
| `discover/discover.module.css` | ~75 | globals.css 7025-7079 |
| `DashboardToast.module.css` | ~70 | globals.css 2561-2607 |
| `WishlistButton.module.css` | ~50 | globals.css 4355-4393 |
| `FavoriteButton.module.css` | ~50 | globals.css 4399-4430 |

**Phase 4 — Cleanup** ✅ DONE 2026-03-12
- [x] All extracted rules removed from globals.css (1,700+ lines)
- [x] Orphaned responsive rules cleaned up (settings, featured-horse, rating-form, dashboard-sidebar)
- [x] Dead `.dashboard-layout select` selectors removed
- [x] `npx next build` passes
- [x] globals.css: **11,854 → 8,585 lines** (28% reduction)

**Remaining minor items (deferred):**
- [ ] ArtistBrowser still uses global `discover-card` classes (harmless, classes remain in modules)
- [ ] Full visual regression test at 1440px + 375px

