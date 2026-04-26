---
description: "V44 Visual QA Phase 3 — Tables & Grids. Audit all data tables, card grids, and list views for header alignment, mobile overflow, hover states, and zebra striping."
---

# V44 Visual QA — Phase 3: Tables & Grids

> **Epic:** V44 Site-Wide Visual QA Audit
> **Goal:** Every table scrolls horizontally on mobile, every grid reflows correctly, and every data display has adequate contrast and alignment.
> **Prerequisite:** Phase 2 complete.

**MANDATORY:** Read `.agents/MASTER_BLUEPRINT.md` and `.agents/MASTER_SUPABASE.md` first. All Iron Laws and guardrails apply.

// turbo-all

---

## Pre-flight

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

### Task 3.1: StableGrid — `src/components/StableGrid.tsx`

1. Card grid reflows from 3-col → 2-col → 1-col at breakpoints
2. Card badges (OF/Custom/Resin, trade status) readable on thumbnails
3. Sort dropdown readable when closed
4. "No results" state has adequate visual weight
5. Search input has visible label or icon
6. Cards with no photo show placeholder that matches parchment palette

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 3.2: StableLedger — `src/components/StableLedger.tsx`

1. Financial table has `overflow-x-auto` wrapper
2. Header row uses `bg-[#F4EFE6]` not `bg-stone-50`
3. Currency values right-aligned
4. Row borders use `border-[#E0D5C1]`
5. Totals row visually distinct (bold, separator above)

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 3.3: Show Results — `src/app/shows/[id]/results/page.tsx`

1. Results table/cards readable on 375px
2. Podium display (1st/2nd/3rd) has adequate contrast
3. Class name headers don't truncate
4. If table format: horizontal scroll wrapper present
5. If card format: cards stack properly on mobile

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 3.4: Catalog Browser — `src/app/catalog/page.tsx`

1. Catalog item cards reflow correctly
2. Item count badges readable
3. Suggestion sidebar content accessible on mobile (stacked below)
4. Top Curators section doesn't overflow

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 3.5: Catalog Suggestion Diff Table — `src/app/catalog/suggestions/[id]/page.tsx`

1. Verify prior mobile overflow fix still holds (`overflow-x-auto` + `min-w-[500px]`)
2. Diff columns (Field, Current, →, Proposed) aligned
3. Vote panel stacks above on mobile
4. Warm palette applied (no cold remnants)

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 3.6: Dashboard Widgets — `src/app/dashboard/page.tsx`

1. Collection stats cards reflow on mobile
2. Quick action buttons wrap (not overflow)
3. Recent activity list items don't truncate
4. CommandCenter layout sidebar stacks below on mobile

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 3.7: CSV Import Preview — `src/app/stable/import/page.tsx`

1. Preview table has `overflow-x-auto`
2. Column headers sticky or visible during scroll
3. Row highlighting for errors uses warm red (not cold red on white)
4. Import count summary readable

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 3.8: Admin Tables — `src/app/admin/page.tsx` + `src/components/AdminTabs.tsx`

1. User management table scrollable on mobile
2. Show management list readable
3. Content moderation items have adequate spacing
4. Tab content tables all have overflow wrappers

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 3.9: Discover Grid — `src/app/discover/page.tsx`

1. User cards reflow correctly at breakpoints
2. Follow button visible on cards
3. Region/badge display doesn't overflow cards

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 3.10: Wishlist & Market Grids — `src/app/wishlist/page.tsx` + `src/app/market/page.tsx`

1. Listing cards show price badges readable on thumbnails
2. "Open to Offers" vs "For Sale" badges distinct
3. Empty state messaging visible
4. Grid reflow at breakpoints

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 3.11: Collection View — `src/app/stable/collection/[id]/page.tsx`

1. Collection header info readable
2. Horse cards within collection grid reflow
3. Empty collection state visible

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

### Task 3.12: ShowRingGrid — `src/components/ShowRingGrid.tsx`

1. Entry cards display correctly at all breakpoints
2. Status badges (entered, judged, results) have adequate contrast
3. Grid reflow from multi-col to single-col

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

### Task 3.13: Commit

```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "fix(v44): phase 3 — tables & grids audit, overflow wrappers + palette + alignment across 12 surfaces"
```

---

## ✅ DONE Protocol

- [ ] Every data table has `overflow-x-auto` wrapper for mobile
- [ ] All table headers use warm palette (`bg-[#F4EFE6]`)
- [ ] All card grids reflow correctly at 375px, 768px, 1024px
- [ ] No horizontal scrollbar on any page at any breakpoint (except inside scroll wrappers)
- [ ] Build passes, committed

**Next:** Run `/v44-visual-qa-phase4-text-sections`
