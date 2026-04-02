---
description: Macro-Layout Fixes — Layout archetype padding, grid column collapse, table horizontal scroll containment
---

# 073 — Macro-Layouts, Grids & Data Tables

> **Purpose:** Fix the three categories of layout elements that cause the most mobile overflow: page wrapper padding, multi-column grids that don't collapse, and data tables that exceed viewport width.
> **Depends On:** `072-mobile-viewport-globals.md` (root overflow + typography must be applied first)
> **Output:** All layout archetypes, grids, and tables render cleanly within 390px viewport.

// turbo-all

---

## Task 1: Layout Archetype Padding Audit

**Files:** `src/components/layouts/*.tsx`

### 1.1 Current state assessment

All 4 Layout Archetypes already use mobile-first responsive padding. Verify each is correct:

| Layout | File | Current Padding | Status |
|--------|------|----------------|--------|
| `ExplorerLayout` | `ExplorerLayout.tsx:22` | `px-4 py-8 sm:px-6 md:py-12 lg:px-8` | ✅ Already correct |
| `ScrapbookLayout` | `ScrapbookLayout.tsx:20` | `px-4 py-8 sm:px-6 md:py-12 lg:px-8` | ✅ Already correct |
| `CommandCenterLayout` | `CommandCenterLayout.tsx:22` | `px-4 py-8 sm:px-6 md:py-12 lg:px-8` | ✅ Already correct |
| `FocusLayout` | `FocusLayout.tsx:20` | `px-4 py-12 sm:px-6 md:py-16` | ✅ Already correct |

### 1.2 Verify grid collapse behavior

The layouts that use CSS Grid must confirm they collapse to single column on mobile:

**ScrapbookLayout (line 24):**
```tsx
// Current: grid-cols-1 ... lg:grid-cols-[1.5fr_1fr]
// ✅ Already collapses to 1 column on mobile
```

**CommandCenterLayout (line 39):**
```tsx
// Current: grid-cols-1 ... lg:grid-cols-[1fr_320px]
// ✅ Already collapses to 1 column on mobile
```

### 1.3 Search for pages NOT using Layout Archetypes

```powershell
cmd /c "npx rg -l 'ExplorerLayout|ScrapbookLayout|CommandCenterLayout|FocusLayout' src/app/ --include '*.tsx' 2>&1"
```

Then compare against the full list of `page.tsx` files:
```powershell
cmd /c "Get-ChildItem -Recurse src/app -Filter page.tsx | Measure-Object | Select-Object Count"
```

Any page NOT using a layout archetype needs manual padding verification. Expected exclusions:
- `src/app/page.tsx` — Landing page (bespoke hero layout)
- `src/app/inbox/[conversationId]/page.tsx` — Chat (full-height layout)

For each excluded page, verify it has `px-4` (or similar tight padding) on its outermost container.

### Validation Checklist
- [ ] All 4 Layout Archetypes have mobile-first padding (`px-4` minimum)
- [ ] ScrapbookLayout and CommandCenterLayout collapse to 1 column below `lg:`
- [ ] Pages not using Layout Archetypes have been manually verified for mobile padding
- [ ] No page uses raw `px-8` or `px-12` without a breakpoint prefix

---

## Task 2: Grid Column Collapse Audit

### 2.1 Find all multi-column grids

```powershell
cmd /c "npx rg -n 'grid-cols-[2-9]|grid-cols-\[' src/ --include '*.tsx' 2>&1"
```

This catches:
- `grid-cols-2` through `grid-cols-9` — fixed column grids
- `grid-cols-[...]` — arbitrary column definitions

### 2.2 Classification and fix rules

For each grid found, classify and apply the correct mobile-first pattern:

| Current Pattern | Fix | Example |
|----------------|-----|---------|
| `grid-cols-2` (no responsive) | `grid-cols-1 sm:grid-cols-2` | Stats cards, feature pairs |
| `grid-cols-3` (no responsive) | `grid-cols-1 sm:grid-cols-2 lg:grid-cols-3` | Card grids |
| `grid-cols-4` (no responsive) | `grid-cols-2 sm:grid-cols-3 lg:grid-cols-4` | Icon grids, badge grids |
| `grid-cols-[1fr_320px]` | `grid-cols-1 lg:grid-cols-[1fr_320px]` | Dashboard layouts |
| `grid-cols-[1.5fr_1fr]` | `grid-cols-1 lg:grid-cols-[1.5fr_1fr]` | Scrapbook layouts |

**The rule:** If the grid classes do NOT have a breakpoint prefix for the multi-column value, it's a mobile overflow bug.

### 2.3 `auto-fill` grids (usually safe)

Grids using `repeat(auto-fill, minmax(...))` are self-responsive:
```tsx
className="grid grid-cols-[repeat(auto-fill,minmax(280px,1fr))]"
```

These are **SAFE** — they auto-collapse on narrow viewports. No change needed.

**Verify:** Check that the `minmax` min value is ≤ `340px` (390px viewport - 2×16px padding = 358px usable). If any `minmax(400px, ...)` exists, reduce to `minmax(280px, ...)`.

### 2.4 Key components to audit

| Component | File | Expected Grid | Fix If Needed |
|-----------|------|--------------|---------------|
| `StableGrid` | `StableGrid.tsx` | `auto-fill, minmax(280px, 1fr)` | Check minmax min ≤ 340px |
| `ShowRingGrid` | `ShowRingGrid.tsx` | `auto-fill, minmax(280px, 1fr)` | Check minmax min ≤ 340px |
| `TrophyCase` | `TrophyCase.tsx` | Multi-column badges | Needs `grid-cols-2 sm:grid-cols-3` |
| `ShowEntryGrid` | `ShowEntryGrid.tsx` | Photo entry grid | Check column collapse |
| Landing page | `page.tsx` | Feature grid sections | Verify collapse |
| Dashboard page | `dashboard/page.tsx` | Stat cards | Verify collapse |

### Validation Checklist
- [ ] Every `grid-cols-N` (where N ≥ 2) has a responsive breakpoint prefix
- [ ] `auto-fill` grids have `minmax` min values ≤ 340px
- [ ] No grid produces horizontal overflow at 390px viewport width
- [ ] Run `npm run test:devices` — overflow tests should show improvement

---

## Task 3: Table Horizontal Scroll Containment

### 3.1 The problem

HTML `<table>` elements (including shadcn `<Table>`) cannot shrink below their content width. On mobile, a 5-column table will always overflow a 390px viewport. **The fix:** Wrap tables in a scrollable container so the TABLE scrolls, not the PAGE.

### 3.2 Find all table usages

```powershell
cmd /c "npx rg -n '<Table' src/ --include '*.tsx' -l 2>&1"
cmd /c "npx rg -n '<table' src/ --include '*.tsx' -l 2>&1"
```

### 3.3 Apply scroll wrapper pattern

For each `<Table>` or `<table>` element, wrap it in a scroll container:

```tsx
// BEFORE:
<Table>
    <TableHeader>...</TableHeader>
    <TableBody>...</TableBody>
</Table>

// AFTER:
<div className="w-full overflow-x-auto -mx-4 px-4 sm:mx-0 sm:px-0">
    <Table className="min-w-[600px]">
        <TableHeader>...</TableHeader>
        <TableBody>...</TableBody>
    </Table>
</div>
```

**Why `-mx-4 px-4 sm:mx-0 sm:px-0`?** This creates edge-to-edge scrolling on mobile (the table bleeds to screen edges for maximum space) while reverting to normal containment on desktop.

**Why `min-w-[600px]`?** This prevents the table from squishing columns too tightly. The exact value should match the table's content — use `600px` for 4-5 column tables, `500px` for 3-column tables.

### 3.4 Key table components to audit

| Component | File | Columns | Recommended `min-w` |
|-----------|------|---------|---------------------|
| `CatalogBrowser` | `CatalogBrowser.tsx` | ~5 (name, type, company, year, actions) | `min-w-[640px]` |
| `ShowStringManager` | `ShowStringManager.tsx` | ~4 (horse, class, division, actions) | `min-w-[560px]` |
| Market price tables | `market/page.tsx` | ~5 (item, avg, min, max, count) | `min-w-[600px]` |
| Admin tables | `admin/page.tsx` | Varies | `min-w-[600px]` |
| Blue Book charts | `BlueBookProCharts.tsx` | Data tables | `min-w-[500px]` |
| Catalog suggestion tables | `catalog/suggestions/page.tsx` | ~5 | `min-w-[640px]` |

### 3.5 Alternative: Responsive card layout for key tables

For tables where users need to interact (not just scan), consider an alternative mobile pattern:

```tsx
{/* Desktop: Table */}
<div className="hidden sm:block">
    <Table>...</Table>
</div>

{/* Mobile: Card stack */}
<div className="sm:hidden space-y-3">
    {data.map(item => (
        <div key={item.id} className="rounded-lg border border-edge bg-card p-4 space-y-2">
            <div className="font-medium text-ink">{item.name}</div>
            <div className="text-sm text-muted-foreground">{item.details}</div>
        </div>
    ))}
</div>
```

This is a **nice-to-have** enhancement — prioritize the scroll wrapper approach for all tables first. Card layout conversions can be a follow-up.

### Validation Checklist
- [ ] Every `<Table>` / `<table>` is wrapped in a `div.overflow-x-auto` container
- [ ] Tables have appropriate `min-w-[Npx]` to prevent column squishing
- [ ] Scroll indicator (momentum scrolling) works on iOS Safari
- [ ] No TABLE causes the entire PAGE to scroll horizontally
- [ ] Run `npm run test:mobile` — table-heavy pages should now pass

---

## 🛑 HUMAN VERIFICATION GATE 🛑

**Stop execution. Run the mobile overflow test suite:**

```powershell
cmd /c "npx playwright test e2e/device-layout.spec.ts 2>&1"
```

Compare results with the baseline from `071-mobile-qa-automation.md`. Record improvements:

```
BEFORE: 4/10 passing
AFTER:  8/10 passing (fixed: /dashboard, /market, /shows, /community)
```

Await human input: "Phase 073 Verified. Proceed."

---

## Build Gate

Run `npx next build` (via `cmd /c "npx next build 2>&1"`) and confirm 0 errors before marking complete.
