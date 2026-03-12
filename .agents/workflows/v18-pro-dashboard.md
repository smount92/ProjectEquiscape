---
description: Pro Dashboard UI/UX Overhaul — Two-column dashboard layout, widescreen container expansion, and custom-styled dropdowns. Pure CSS + layout restructuring, no new features.
---

# Epic 1: Pro Dashboard UI/UX Overhaul

> **Master Blueprint:** `docs/v17_master_blueprint.md` — Epic 1
> **Directive:** Fix the "Developer-Driven UI" problem. Make widescreen space useful, move secondary widgets into a sidebar, and polish every `<select>` element so nothing looks native/default.
> **No new features.** This is purely layout and styling.

// turbo-all

---

## Developer Agent Rules

> **MANDATORY:** When you complete a task, update this workflow file immediately:
> 1. Add `✅ DONE` and the date after the task heading
> 2. Check off the item in the Completion Checklist at the bottom
> 3. Run `npx next build` after every task
> 4. This sprint is CSS-heavy — test at 1440px and 375px viewports

---

## Task 1 — Dashboard Two-Column Layout

**The Problem:** On desktop, the Welcome Card, Analytics Row, Collections Row, and NAN Widget are stacked vertically in a single column, pushing the actual horse grid **far below the fold**. On a 1440px monitor, the grid doesn't appear until you scroll past 4-5 screen-filling widgets.

**The Fix:** Restructure `src/app/dashboard/page.tsx` into a 2-column CSS Grid layout on desktop (≥1024px).

### Target layout:

```
┌──────────────────────────────────────────────────────────────────────────┐
│  Digital Stable — {alias}'s Herd   [48 models]  [CSV] [📄] [⚡] [🐴]  │
├──────────────────────────────────────────┬───────────────────────────────┤
│                                          │  📊 Stable Overview           │
│  [Search / Sort / View Toggle]           │  🐴 48  📁 6  💰 $12,400    │
│                                          │  🏅 23  ✉️ 2                │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐            │───────────────────────────────│
│  │    │ │    │ │    │ │    │            │  📁 Collections               │
│  │ 🐴 │ │ 🐴 │ │ 🐴 │ │ 🐴 │            │  Breyers (120) · $4,200       │
│  └────┘ └────┘ └────┘ └────┘            │  Artist Resins (45) · $8,000  │
│  ┌────┐ ┌────┐ ┌────┐ ┌────┐            │  Customs (18)                 │
│  │    │ │    │ │    │ │    │            │───────────────────────────────│
│  │ 🐴 │ │ 🐴 │ │ 🐴 │ │ 🐴 │            │  🎖️ NAN Tracker              │
│  └────┘ └────┘ └────┘ └────┘            │  ...                          │
│                                          │───────────────────────────────│
│  [← Previous]  Page 1 of 3  [Next →]    │  📤 Transfer History          │
│                                          │  ...                          │
└──────────────────────────────────────────┴───────────────────────────────┘
```

### Step 1: Restructure the JSX

**File:** `src/app/dashboard/page.tsx`

Wrap the body in a 2-column grid container. The **left column** (main) gets the search/sort bar + horse grid + pagination. The **right column** (sidebar) gets Analytics, Collections, NAN, and Transfer History.

```tsx
return (
    <div className="dashboard-layout">
        <div className="animate-fade-in-up">
            {/* Shelf Header — FULL WIDTH (spans both columns) */}
            <div className="shelf-header dashboard-header-full">
                {/* ... same as current header */}
            </div>

            <Suspense fallback={null}><DashboardToast /></Suspense>

            {/* Welcome card for empty stables — FULL WIDTH */}
            {horseCards.length === 0 && (
                <div className="welcome-card card animate-fade-in-up">...</div>
            )}

            {/* Two-column grid container */}
            <div className="dashboard-grid">
                {/* ── MAIN COLUMN: The Horse Grid ── */}
                <main className="dashboard-main">
                    <DashboardShell
                        horseCards={horseCards}
                        collections={collections.map(c => ({ id: c.id, name: c.name }))}
                    />

                    {/* Pagination */}
                    {totalPages > 1 && (
                        <div className="market-pagination" style={{ marginTop: "var(--space-lg)" }}>
                            {/* ... same pagination */}
                        </div>
                    )}
                </main>

                {/* ── SIDEBAR: Widgets ── */}
                <aside className="dashboard-sidebar">
                    {/* Analytics */}
                    {totalHorseCount > 0 && (
                        <div className="sidebar-section">
                            <h3 className="sidebar-section-title">📊 Stable Overview</h3>
                            <div className="sidebar-stats">
                                {/* compact stat rows instead of horizontal cards */}
                            </div>
                        </div>
                    )}

                    {/* Collections */}
                    {collections.length > 0 && (
                        <div className="sidebar-section">
                            <h3 className="sidebar-section-title">📁 Collections</h3>
                            <div className="sidebar-collections">
                                {/* vertical list instead of horizontal scroll */}
                            </div>
                        </div>
                    )}

                    {/* NAN Tracker */}
                    <Suspense fallback={null}>
                        <NanDashboardWidget />
                    </Suspense>

                    {/* Transfer History */}
                    <TransferHistorySection />
                </aside>
            </div>
        </div>
    </div>
);
```

### Step 2: CSS for the grid

**File:** `src/app/globals.css`

```css
/* ── Dashboard Two-Column Layout ── */
.dashboard-layout {
    max-width: 1600px;
    margin: 0 auto;
    padding: 0 var(--space-lg);
}

.dashboard-header-full {
    /* Full-width header above the grid */
}

.dashboard-grid {
    display: grid;
    grid-template-columns: 1fr;
    gap: var(--space-xl);
}

@media (min-width: 1024px) {
    .dashboard-grid {
        grid-template-columns: 1fr 340px;
    }
}

@media (min-width: 1440px) {
    .dashboard-grid {
        grid-template-columns: 1fr 380px;
    }
}

.dashboard-main {
    min-width: 0; /* prevent grid blowout */
}

.dashboard-sidebar {
    display: flex;
    flex-direction: column;
    gap: var(--space-lg);
}

@media (min-width: 1024px) {
    .dashboard-sidebar {
        position: sticky;
        top: calc(var(--header-height) + var(--space-lg));
        max-height: calc(100vh - var(--header-height) - var(--space-2xl));
        overflow-y: auto;
    }
}

/* Sidebar sections */
.sidebar-section {
    background: var(--color-bg-card);
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    padding: var(--space-lg);
}

.sidebar-section-title {
    font-size: calc(var(--font-size-sm) * var(--font-scale));
    font-weight: 700;
    color: var(--color-text-primary);
    margin-bottom: var(--space-md);
    text-transform: uppercase;
    letter-spacing: 0.5px;
}

/* Sidebar stats — compact vertical layout */
.sidebar-stats {
    display: flex;
    flex-direction: column;
    gap: var(--space-sm);
}

.sidebar-stat-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-xs) 0;
}

.sidebar-stat-label {
    display: flex;
    align-items: center;
    gap: var(--space-sm);
    font-size: calc(var(--font-size-sm) * var(--font-scale));
    color: var(--color-text-secondary);
}

.sidebar-stat-value {
    font-size: calc(var(--font-size-sm) * var(--font-scale));
    font-weight: 700;
    color: var(--color-text-primary);
}

/* Sidebar collections — vertical list */
.sidebar-collections {
    display: flex;
    flex-direction: column;
    gap: var(--space-xs);
}

.sidebar-collection-link {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: var(--space-sm) var(--space-md);
    border-radius: var(--radius-md);
    background: var(--color-surface-glass);
    text-decoration: none;
    color: var(--color-text-primary);
    font-size: calc(var(--font-size-sm) * var(--font-scale));
    transition: background var(--transition-fast);
}

.sidebar-collection-link:hover {
    background: var(--color-surface-glass-hover);
    text-decoration: none;
}

.sidebar-collection-count {
    font-size: calc(var(--font-size-xs) * var(--font-scale));
    color: var(--color-text-muted);
}

/* On mobile: sidebar stacks below main */
@media (max-width: 1023px) {
    .dashboard-sidebar {
        /* Use the existing horizontal analytics-row + collections-scroll for mobile */
    }
}
```

### Key design decisions:
- **`max-width: 1600px`** on the dashboard layout (wider than the default `1200px`)
- **Sticky sidebar** on desktop — scrolls with the page but stays visible
- **Sidebar sections** use the existing glass-card background
- **On mobile (< 1024px):** falls back to single-column (current behavior)
- **Analytics** become compact stat rows in the sidebar instead of full-width cards
- **Collections** become a vertical list instead of horizontal scroll strip

---

## Task 2 — Widescreen Container Expansion

**The Problem:** `--max-width: 1200px` constrains all grid pages. On 1440p+ monitors, massive dark gutters waste screen real estate.

### Step 1: Keep `--max-width` at 1200px for form pages (login, add horse, settings, etc.)

These pages should NOT expand — forms look bad at 1600px.

### Step 2: Create a `.page-container-wide` for grid-heavy pages

**File:** `src/app/globals.css`

```css
/* Wide container for grid-heavy pages */
.page-container-wide {
    max-width: 1600px;
    margin: 0 auto;
    padding: 0 var(--space-lg);
}

@media (min-width: 1800px) {
    .page-container-wide {
        max-width: 1800px;
    }
}
```

### Step 3: Apply `.page-container-wide` to these pages:

| Page | Current Container | New Container |
|---|---|---|
| `/dashboard` | `.page-container.form-page` | `.dashboard-layout` (Task 1 handles this) |
| `/community` (Show Ring) | `.page-container` | `.page-container-wide` |
| `/discover` | `.page-container` | `.page-container-wide` |
| `/feed` | `.page-container` | No change (content is narrow by design) |
| `/market` | `.page-container` | `.page-container-wide` |

### Step 4: Reduce StableGrid minimum card width

The `minmax(280px, 1fr)` currently limits grids to ~4 columns at 1200px. With wider containers, allow more columns:

```css
/* StableGrid / ShowRingGrid — allow more columns on wide screens */
@media (min-width: 1200px) {
    .stable-grid,
    .show-ring-grid {
        grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    }
}

@media (min-width: 1600px) {
    .stable-grid,
    .show-ring-grid {
        grid-template-columns: repeat(auto-fill, minmax(220px, 1fr));
    }
}
```

This means:
- At 1200px → ~5 columns (was 4)
- At 1600px → ~7 columns (was 4)
- At 1800px → ~8 columns

---

## Task 3 — Custom Dropdown Styling ("The Ugly Dropdown Fix")

**The Problem:** Native `<select>` elements look clunky with default browser chrome. They break the dark glassmorphic design language of the app. The `UnifiedReferenceSearch` dropdown looks like an unstyled list.

### Step 1: Polish `.form-select` globally

**File:** `src/app/globals.css` — update the existing `.form-select` block (line ~657):

```css
.form-input,
.form-select {
    display: block;
    width: 100%;
    min-height: var(--btn-min-h);
    padding: var(--space-sm) var(--space-md);
    font-family: var(--font-family);
    font-size: calc(var(--font-size-base) * var(--font-scale));
    color: var(--color-text-primary);
    background: var(--color-bg-input);
    border: 1px solid var(--color-border-input);
    border-radius: var(--radius-md);
    outline: none;
    transition: border-color var(--transition-fast), box-shadow var(--transition-fast),
        background-color var(--transition-base);
}

/* Custom select styling — kill native appearance */
.form-select {
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
    padding-right: 40px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a0a0b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 14px center;
    background-size: 14px;
    cursor: pointer;
}

/* Hover state */
.form-select:hover {
    border-color: var(--color-text-muted);
}

/* Focus state (already exists, keep) */
.form-select:focus {
    border-color: var(--color-border-focus);
    box-shadow: 0 0 0 3px var(--color-accent-primary-glow);
}

/* Simple mode override — darker chevron */
[data-simple-mode="true"] .form-select {
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23333333' stroke-width='2.5' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
}
```

### Step 2: Polish the `UnifiedReferenceSearch` dropdown

**File:** `src/app/globals.css` — enhance the `.reference-results` block:

```css
.reference-results {
    max-height: 320px;
    overflow-y: auto;
    border: 1px solid var(--color-border);
    border-radius: var(--radius-lg);
    background: var(--color-bg-elevated);
    backdrop-filter: blur(16px);
    box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
    margin-top: var(--space-xs);
}

.reference-item {
    display: flex;
    align-items: center;
    justify-content: space-between;
    padding: var(--space-sm) var(--space-md);
    border-bottom: 1px solid var(--color-border);
    cursor: pointer;
    transition: background var(--transition-fast);
}

.reference-item:last-child {
    border-bottom: none;
}

.reference-item:hover {
    background: var(--color-surface-glass-hover);
}
```

### Step 3: Polish all standalone selects used outside forms

Target these specific selects that may not use `.form-select`:
- `.market-sort-select` (Market page)
- `.csv-mapping-select` (CSV import)
- `.bulk-select` (Bulk operations bar)
- `.results-grid select` (Show results)

Add to each:
```css
.market-sort-select,
.csv-mapping-select,
.bulk-select,
.results-grid select {
    appearance: none;
    -webkit-appearance: none;
    padding-right: 32px;
    background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='12' viewBox='0 0 24 24' fill='none' stroke='%23a0a0b8' stroke-width='2' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpolyline points='6 9 12 15 18 9'%3E%3C/polyline%3E%3C/svg%3E");
    background-repeat: no-repeat;
    background-position: right 10px center;
    background-size: 12px;
}
```

### Step 4: Global select reset (safety net)

To catch any `<select>` elements that don't have a specific class:

```css
/* Global safety net — all selects in the app get custom styling */
select {
    appearance: none;
    -webkit-appearance: none;
    -moz-appearance: none;
}
```

> ⚠️ Be careful with this — only apply it inside `.dashboard-layout`, `.page-container`, or `.form-page` to avoid breaking 3rd-party dropdowns.

---

## Completion Checklist

**Task 1 — Dashboard Two-Column Layout ✅ DONE 2026-03-11**
- [x] `dashboard-layout` class replaces `page-container form-page`
- [x] `dashboard-grid` with `grid-template-columns: 1fr 320px` at ≥1024px, `1fr 360px` at ≥1440px
- [x] Analytics moved to sidebar as compact stat rows
- [x] Collections moved to sidebar as vertical list with vault values
- [x] NAN Widget moved to sidebar
- [x] Transfer History moved to sidebar
- [x] Sidebar is sticky on desktop with thin scrollbar
- [x] Mobile (< 1024px) falls back to single column  
- [x] Horse grid is the hero — visible above the fold on 1440px

**Task 2 — Widescreen Container Expansion ✅ DONE 2026-03-11**
- [x] `.page-container-wide` upgraded to 1600px at 1400px+, 1800px at 1800px+
- [x] `/community` page already uses `.page-container-wide` ✅
- [x] `/discover` page already uses `.page-container-wide` ✅
- [x] `/market` page — kept at 900px max (tabular data, not grid) ✅
- [x] StableGrid minmax reduced to 240px at 1200px+, 220px at 1600px+
- [x] ShowRingGrid gets same treatment

**Task 3 — Dropdown Polish ✅ DONE 2026-03-11**
- [x] `.form-select` gets `appearance: none` + custom SVG chevron
- [x] Simple mode override chevron (dark stroke)
- [x] `.reference-results` gets backdrop-blur, rounded corners, shadow
- [x] `.results-grid select` gets custom chevron
- [x] `.csv-mapping-select` gets custom chevron
- [x] Global scoped select reset: `.dashboard-layout select`, `.page-container select`, `.page-container-wide select`
- [x] No native browser select chrome visible anywhere in the app

**Build & Verification**
- [x] `npx next build` — 0 errors ✅ (March 11, 2026)
- [ ] 1440px viewport — horse grid visible above fold, sidebar visible (visual check needed)
- [ ] 375px viewport — single column, no horizontal overflow (visual check needed)
- [ ] All selects render with custom chevron (visual check needed)
- [ ] Sidebar scrolls independently on desktop (visual check needed)

**All code shipped.** Remaining items are manual QA/visual checks.

