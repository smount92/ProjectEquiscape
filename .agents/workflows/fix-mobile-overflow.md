---
description: Fix 6 mobile overflow issues where content is clipped/inaccessible due to the global overflow-x:hidden safety net. Catalog sidebar, Admin tabs, suggestion diff table, CommandCenter header actions, Manage Event tabs, and chat header trust signals.
---

# Fix: Mobile Overflow — 6 Clipped/Inaccessible Surfaces

> **Context:** A mobile responsiveness audit revealed that the global `overflow-x: hidden` on `html, body` (globals.css L178–182) is masking layout bugs on 6 surfaces. Content is being clipped off-screen rather than reflowing or scrolling. This was the original "mobile fix" from Sprint N-0.5 — it prevented horizontal scrollbars but merely hid the underlying layout issues instead of resolving them.
> **Audit Document:** See conversation artifact `mobile_overflow_audit.md` for full page-by-page analysis.

**MANDATORY:** Read `.agents/MASTER_BLUEPRINT.md` and `.agents/MASTER_SUPABASE.md` first. All Iron Laws and guardrails apply.

**Scope:** CSS/layout-only changes. NO new migrations, NO new server actions, NO database changes. NO new components.

**Palette constraint:** All new CSS must use the warm parchment palette (see `MASTER_BLUEPRINT.md` — Cold palette BANNED). However, these fixes are primarily adding responsive breakpoints and scroll containers — palette impact should be minimal. If you encounter any `bg-white` or `border-stone-200` during edits, migrate them to `bg-[#FEFCF8]` and `border-[#E0D5C1]` respectively.

// turbo-all

---

## Pre-flight

Verify the current build is clean:

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

Check recent git history:

```
cd c:\Project Equispace\model-horse-hub && git log --oneline -5
```

---

## Fix 1: Catalog Page — Fixed Grid (🔴 HIGH)

**File:** `src/app/catalog/page.tsx`
**Line:** 79
**Problem:** `grid-cols-[1fr_280px]` with NO responsive breakpoint. At 375px, the 280px sidebar eats ~75% of viewport. The sidebar contains "View Suggestions", "Suggest New Entry", "View Changelog", and "Top Curators" — all clipped off-screen on mobile.
**Pattern Source:** Dashboard page (`src/app/dashboard/page.tsx`) already uses the correct responsive version via `CommandCenterLayout` which applies `grid-cols-1 lg:grid-cols-[1fr_320px]`.

### 1.1 Apply responsive grid breakpoint

**Current (line 79):**
```tsx
<div className="grid-cols-[1fr_280px] grid gap-8">
```

**Replace with:**
```tsx
<div className="grid grid-cols-1 gap-8 lg:grid-cols-[1fr_280px]">
```

This stacks the sidebar below the main content on mobile/tablet, and restores the two-column layout on large screens (≥1024px).

### 1.2 Validation

- [ ] At 375px: sidebar section appears BELOW the main catalog listing, fully visible and scrollable
- [ ] At 1024px+: two-column layout is maintained (sidebar on right)
- [ ] "View Suggestions" and "Top Curators" links are reachable on mobile
- [ ] No horizontal scrollbar appears at any width

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Fix 2: Admin Console — Tab Bar Overflow (🔴 HIGH)

**File:** `src/components/AdminTabs.tsx`
**Line:** 187
**Problem:** 5 tabs (Mailbox, Shows, Content, Reports, Catalog) in a `flex` row with no wrapping or horizontal scroll. Each tab has emoji + label + badge. At 375px, the last 1–2 tabs (Reports, Catalog) are clipped off the right edge.

> **Note:** There IS a mobile CSS rule at `globals.css` L1440–1442 that hides `.admin-tab-label` elements, but `AdminTabs.tsx` does NOT use those CSS classes — it uses inline Tailwind. So the CSS rule has zero effect. We fix this at the component level.

### 2.1 Add horizontal scroll to the tab bar

**Current (line 187):**
```tsx
<div className="mb-6 flex gap-1 border-b border-stone-200">
```

**Replace with:**
```tsx
<div className="mb-6 flex gap-1 overflow-x-auto border-b border-[#E0D5C1] [-webkit-overflow-scrolling:touch] [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
```

This makes the tab bar horizontally scrollable on mobile while hiding the scrollbar chrome for a clean look. Users can swipe to access all tabs.

### 2.2 Ensure tabs don't shrink

Each tab button (line 193) already has `whitespace-nowrap` ✅. No additional changes needed for individual tabs.

### 2.3 Also fix the warm palette violation

While editing line 187, note the `border-stone-200` — replace with `border-[#E0D5C1]` (warm palette).

### 2.4 Validation

- [ ] At 375px: all 5 tabs can be reached by swiping horizontally
- [ ] Tab bar scrolls smoothly without visible scrollbar
- [ ] Active tab indicator (border-bottom) still renders correctly
- [ ] Tab badges (notification counts) still display
- [ ] At 768px+: all tabs fit without scrolling (same behavior as before)

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Fix 3: Catalog Suggestion Diff Table (🔴 HIGH)

**File:** `src/app/catalog/suggestions/[id]/page.tsx`
**Lines:** 147, 229–240
**Problem:** Two fixed grids:
1. Line 147: `grid-cols-[60px 1fr]` — vote panel + content (minor, but should stack on mobile)
2. Lines 229–240: `grid-cols-[1fr_1fr_40px_1fr]` — diff table with 4 columns (Field, Current, →, Proposed) becomes unreadable at 375px

### 3.1 Make vote panel responsive

**Current (line 147):**
```tsx
<div className="grid-cols-[60px 1fr] grid gap-4">
```

**Replace with:**
```tsx
<div className="grid grid-cols-1 gap-4 sm:grid-cols-[60px_1fr]">
```

On mobile, the vote buttons appear above the content card. On `sm` (640px+), the original side-by-side layout returns.

### 3.2 Wrap diff table in horizontal scroll container

Instead of trying to squeeze 4 columns into 375px, wrap the table in a scroll container. This preserves the diff readability.

**Current (lines 229–230):**
```tsx
<div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
  <div className="grid grid-cols-[1fr_1fr_40px_1fr] border-b border-stone-200 bg-stone-50 p-3 text-xs font-bold tracking-wider text-stone-500 uppercase">
```

**Replace the outer wrapper (line 229 only) with:**
```tsx
<div className="overflow-x-auto rounded-xl border border-[#E0D5C1] bg-[#FEFCF8] shadow-sm [-webkit-overflow-scrolling:touch]">
  <div className="min-w-[500px]">
```

And close the new inner `<div>` after the diff rows end (after line 250, before the closing `</div>` at line 251):
```tsx
  </div>  {/* end min-w-[500px] */}
</div>    {/* end overflow-x-auto */}
```

The `min-w-[500px]` ensures the table doesn't collapse below a readable width. Users swipe horizontally on mobile to see all columns.

### 3.3 Fix warm palette violations

While editing these lines:
- Line 229: `border-stone-200 bg-white` → `border-[#E0D5C1] bg-[#FEFCF8]`
- Line 230: `border-stone-200 bg-stone-50` → `border-[#E0D5C1] bg-[#F4EFE6]`
- Line 240: `border-stone-100` → `border-[#E0D5C1]/40`

### 3.4 Validation

- [ ] At 375px: vote panel appears above content card (stacked)
- [ ] At 375px: diff table can be horizontally scrolled to see all 4 columns
- [ ] At 640px+: vote panel returns to the left sidebar position
- [ ] At 768px+: diff table fits without scrolling
- [ ] Column headers (Field, Current, →, Proposed) stay aligned with data rows during scroll

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Fix 4: CommandCenterLayout — Header Actions (🟡 MEDIUM)

**File:** `src/components/layouts/CommandCenterLayout.tsx`
**Line:** 33
**Problem:** The `headerActions` slot renders buttons in a `flex` row without `flex-wrap`. When 3 buttons are rendered (e.g., Dashboard's "Batch Import", "Quick Add", "Add to Stable"), they can overflow at 375px — especially under font scaling or `data-simple-mode`.

### 4.1 Add `flex-wrap` to headerActions container

**Current (line 33):**
```tsx
{headerActions && <div className="flex gap-3">{headerActions}</div>}
```

**Replace with:**
```tsx
{headerActions && <div className="flex flex-wrap gap-3">{headerActions}</div>}
```

### 4.2 Validation

- [ ] At 375px: header buttons wrap to a second row instead of overflowing
- [ ] At 375px with `data-simple-mode`: buttons still don't overflow (larger 130% font scale)
- [ ] At 768px+: buttons remain in a single row
- [ ] Dashboard page specifically: 3 action buttons display correctly at all widths

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Fix 5: Manage Event — Tab Bar (🟡 MEDIUM)

**File:** `src/app/community/events/[id]/manage/page.tsx`
**Line:** 446
**Problem:** Tab bar with 3 tabs (Edit Details, Class List, Judges) uses `var(--space-md)` padding. At 375px, tabs with full label text can clip.

### 5.1 Add horizontal scroll to tab bar

**Current (line 446):**
```tsx
<div className="flex gap-[var(--space-xs)] mb-[var(--space-xl)] border-b border-stone-200 pb-0">
```

**Replace with:**
```tsx
<div className="flex gap-[var(--space-xs)] mb-[var(--space-xl)] overflow-x-auto border-b border-[#E0D5C1] pb-0 [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
```

### 5.2 Validation

- [ ] At 375px: all 3 tabs are accessible (either visible or reachable by swipe)
- [ ] Tab transitions (clicking between tabs) still work correctly
- [ ] Active tab indicator renders properly
- [ ] At 768px+: tabs fit without scrolling

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Fix 6: Chat Header — Trust Signals (🟡 MEDIUM)

**File:** `src/app/inbox/[id]/page.tsx`
**Line:** 220
**Problem:** The chat header packs back button, user info, role badge, trust signals, privacy badge, and block button into a single `flex items-center gap-4` row. Trust signals each have `whitespace-nowrap`. At 375px, items push off-screen.

### 6.1 Add wrap to chat header

**Current (line 220):**
```tsx
<div className="bg-parchment border-edge animate-fade-in-up mb-4 flex shrink-0 items-center gap-4 rounded-lg border px-6 py-4">
```

**Replace with:**
```tsx
<div className="bg-parchment border-edge animate-fade-in-up mb-4 flex shrink-0 flex-wrap items-center gap-4 rounded-lg border px-4 py-4 sm:px-6">
```

Two changes:
1. Added `flex-wrap` — items wrap to next line instead of overflowing
2. Changed `px-6` to `px-4 sm:px-6` — tighter horizontal padding on mobile for more content space

### 6.2 Validation

- [ ] At 375px: all header elements (avatar area, trust signals, block button) are visible — wrapping to 2-3 rows if needed
- [ ] Trust signal badges ("📅 Member since…", "📦 X transfers", "⭐ X.X") are all readable
- [ ] Back arrow button is always visible (first in flow)
- [ ] At 768px+: header renders in a compact single row

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

---

## Final Build Gate

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1"
```

**All 6 fixes must pass clean build — 0 errors.**

---

## Post-Fix: Run Mobile Device Test Suite

Run the existing Playwright device layout tests to verify no regressions:

```
cd c:\Project Equispace\model-horse-hub && npx playwright test e2e/device-layout.spec.ts --reporter=list
```

Expected: 60/60 tests pass across 4 device profiles.

---

## Files Modified Summary

| # | File | Change |
|---|------|--------|
| 1 | `src/app/catalog/page.tsx` | Grid: `grid-cols-[1fr_280px]` → `grid-cols-1 lg:grid-cols-[1fr_280px]` |
| 2 | `src/components/AdminTabs.tsx` | Tab bar: add `overflow-x-auto` + scrollbar hide + warm palette |
| 3 | `src/app/catalog/suggestions/[id]/page.tsx` | Vote: responsive stack. Diff: scroll wrapper + `min-w-[500px]` + warm palette |
| 4 | `src/components/layouts/CommandCenterLayout.tsx` | Header actions: add `flex-wrap` |
| 5 | `src/app/community/events/[id]/manage/page.tsx` | Tab bar: add `overflow-x-auto` + scrollbar hide + warm palette |
| 6 | `src/app/inbox/[id]/page.tsx` | Chat header: add `flex-wrap` + responsive padding |

---

## Update dev-nextsteps.md

After all fixes are applied and build passes, add to `dev-nextsteps.md` under `# 🔴 Priority: Critical`:

```markdown
## ✅ Task MO-1: Mobile Overflow Fixes — DONE (YYYY-MM-DD)

**Workflow:** `.agents/workflows/fix-mobile-overflow.md`
**Source:** Mobile responsiveness audit — 6 surfaces with content clipped by global `overflow-x: hidden`
**Fixes applied:**
1. ✅ **Catalog page** — Fixed grid now responsive (`grid-cols-1 lg:grid-cols-[1fr_280px]`)
2. ✅ **Admin tabs** — Horizontal scroll with hidden scrollbar for 5-tab overflow
3. ✅ **Suggestion diff table** — Vote panel stacks on mobile, diff table has scroll wrapper
4. ✅ **CommandCenterLayout** — Header actions now `flex-wrap` to prevent overflow
5. ✅ **Manage Event tabs** — Horizontal scroll matching Admin tabs pattern
6. ✅ **Chat header** — `flex-wrap` + responsive padding for trust signals
**Status:** ✅ COMPLETE — 0 errors, build clean
```
