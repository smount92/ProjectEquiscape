---
description: "Phase 4: Quiet Luxury DOM Flattening — fix nested boxes, color palette, tables, footer"
status: "✅ COMPLETE (2026-03-28)"
---

# 🚑 Phase 4: UI/UX Rescue & DOM Flattening

**Objective:** The previous layout migration resulted in "The Russian Doll Effect" — deeply nested, over-constrained divs with clashing `bg-card`, `border-edge`, and `rgba()` tinted backgrounds creating boxes-within-boxes-within-boxes. This workflow fixes the global color palette to be subtle and premium, flattens the DOM by stripping legacy container classes from child components, and standardizes all Cards and Tables using `shadcn/ui`.

## Pre-Flight Checklist
// turbo
1. Run `npx next build` and confirm it passes (exit code 0).
// turbo
2. Run `npx vitest run` and confirm 245/245 tests pass.
3. Commit current state: `git add -A && git commit -m "checkpoint: pre-phase-4-dom-flattening"`

---

## 🎨 PHASE 1: The "Quiet Luxury" Color & Footer Fix

**Problem:** The current `--color-bg-primary: #F0EAD6` (yellow parchment) is too heavy. Cards use `#FBF7ED` (tinted cream) instead of clean white. Borders use `#D4C9B5` which is visually heavy. The footer (`#3B2A1A`) is a massive dark brown block.

### Task 1.1: Update CSS Variables to "Quiet Luxury" Palette
**Target File:** `src/app/globals.css`

**Action:** In the `@theme` block (lines 8–51), update the following color variables:

```diff
- --color-parchment: #F0EAD6;
- --color-parchment-dark: #E8DFC9;
- --color-card: #FBF7ED;
- --color-card-hover: #F5EFE0;
- --color-input: #F8F3E8;
- --color-elevated: #FBF7ED;
+ --color-parchment: #FAFAF9;
+ --color-parchment-dark: #F5F5F4;
+ --color-card: #FFFFFF;
+ --color-card-hover: #FAFAF9;
+ --color-input: #FAFAF9;
+ --color-elevated: #FFFFFF;

- --color-edge: #D4C9B5;
+ --color-edge: #E7E5E4;
```

Also update the duplicate `:root` block (lines 55–80) to match:

```diff
- --color-bg-primary: #F0EAD6;
- --color-bg-secondary: #E8DFC9;
- --color-bg-card: #FBF7ED;
- --color-bg-card-hover: #F5EFE0;
- --color-bg-input: #F8F3E8;
- --color-bg-elevated: #FBF7ED;
+ --color-bg-primary: #FAFAF9;
+ --color-bg-secondary: #F5F5F4;
+ --color-bg-card: #FFFFFF;
+ --color-bg-card-hover: #FAFAF9;
+ --color-bg-input: #FAFAF9;
+ --color-bg-elevated: #FFFFFF;
```

**Verification:** Reload any page — the site background should be a clean, subtle off-white (stone-50) instead of heavy parchment yellow.

### Task 1.2: Soften the Footer
**Target File:** `src/components/Footer.tsx`

Replace the entire footer wrapper (line 7):
```diff
- <footer className="mt-auto border-t border-[rgba(139,90,43,0.2)] bg-[#3B2A1A] px-8 pt-16 text-sm text-white/70">
+ <footer className="mt-auto border-t border-stone-200 bg-white px-8 pt-16 text-sm text-stone-600">
```

Update the brand link (line 13):
```diff
- className="mb-2 inline-block text-lg font-extrabold tracking-tight text-[#F0EAD6] no-underline hover:text-[#D4A76A]"
+ className="mb-2 inline-block text-lg font-extrabold tracking-tight text-stone-900 no-underline hover:text-forest"
```

Update brand tagline (line 17):
```diff
- <p className="text-sm leading-relaxed text-white/50">
+ <p className="text-sm leading-relaxed text-stone-400">
```

Update the three column `h4` headers (lines 23, 30, 37):
```diff
- className="mb-1 text-xs font-bold tracking-wider text-white/50 uppercase"
+ className="mb-1 text-xs font-bold tracking-wider text-stone-400 uppercase"
```

Update the three column link containers (lines 22, 29, 36) — replace all occurrences of this pattern:
```diff
- [&_a]:text-white/70 [&_a]:no-underline [&_a]:transition-colors [&_a:hover]:text-[#D4A76A]
+ [&_a]:text-stone-600 [&_a]:no-underline [&_a]:transition-colors [&_a:hover]:text-forest
```

Update the bottom bar (line 47):
```diff
- className="mx-auto flex max-w-[var(--max-width)] items-center justify-between border-t border-white/10 py-6 text-xs text-white/40 ..."
+ className="mx-auto flex max-w-[var(--max-width)] items-center justify-between border-t border-stone-100 py-6 text-xs text-stone-400 ..."
```

Update the bottom bar links container (line 49):
```diff
- [&_a]:text-white/40 [&_a]:no-underline [&_a]:transition-colors [&_a:hover]:text-[#D4A76A]
+ [&_a]:text-stone-400 [&_a]:no-underline [&_a]:transition-colors [&_a:hover]:text-forest
```

**Verification:** The footer should now be light, clean, and professional — white background with stone-colored text. It should feel like part of the page, not a dark termination block.

// turbo
4. Build: `npx next build`
// turbo
5. Test: `npx vitest run`

> ### 🛑 HUMAN VERIFICATION GATE 1 🛑
> **Agent Instructions:** Halt execution. Do NOT proceed until the human developer says **"Phase 1 Verified. Proceed to Phase 2."**
> - [ ] Is the site background now a clean, subtle stone-50 off-white instead of yellow parchment?
> - [ ] Is the footer lighter and less distracting?
> - [ ] Are cards now white instead of cream-tinted?

---

## 🚜 PHASE 2: The "De-Boxing" of the Pages (DOM Flattening)

**Problem:** Many pages have triple-nested `<div>` wrappers where each layer applies `bg-card border-edge border-[rgba(44,85,69,0.2)] rounded-lg border shadow-md`. This creates the "Russian Doll" effect — a green-tinted bordered box inside an identical bordered box inside another identical bordered box.

### Task 2.1: Flatten the Add Horse Form
**Target File:** `src/app/add-horse/page.tsx` (1594 lines)

**The Problem (4 occurrences, one per step):**
Each step has this triple-nesting pattern at the step boundary (e.g., lines 631-633):
```html
<div className="bg-card border-edge border-[rgba(44,85,69,0.2)] relative overflow-visible rounded-lg border shadow-md transition-all">
  <div className="bg-card border-edge border-[rgba(44,85,69,0.2)] sticky top-[var(--header-height)] z-40 border-b border-edge bg-parchment-dark">
    <div className="bg-card border-edge border-[rgba(44,85,69,0.2)] overflow-visible-icon relative rounded-lg border shadow-md transition-all">
      📸
    </div>
```

**The Fix:** For each of the 4 steps:

1. **The outer card:** Replace the triple border+bg classes with a single clean card:
   ```diff
   - <div className="bg-card border-edge border-[rgba(44,85,69,0.2)] relative overflow-visible rounded-lg border shadow-md transition-all">
   + <div className="relative overflow-visible rounded-xl border border-stone-200 bg-white p-6 shadow-sm md:p-8">
   ```

2. **The sticky header:** Strip the duplicate card styling. It should just be a simple flex row:
   ```diff
   - <div className="bg-card border-edge border-[rgba(44,85,69,0.2)] sticky top-[var(--header-height)] z-40 border-b border-edge bg-parchment-dark">
   + <div className="mb-6 flex items-center gap-3">
   ```

3. **The icon wrapper:** Remove the fully-enclosed box around the emoji icon:
   ```diff
   - <div className="bg-card border-edge border-[rgba(44,85,69,0.2)] overflow-visible-icon relative rounded-lg border shadow-md transition-all">
   + <span className="text-2xl">
   ```
   And change closing `</div>` to `</span>`.

**Steps to find each occurrence:**
- Step 0 (Gallery): search for `key="step-0"` — the triple nesting starts on the next line
- Step 1 (Reference): search for `key="step-1"` — same pattern at line ~887-889
- Step 2 (Identity): search for `key="step-2"` — same pattern
- Step 3 (Vault): search for `key="step-3"` — same pattern

Each step always follows this exact 3-div pattern. Replace all 4 identically.

### Task 2.2: Clean Up the Photo Show Page
**Target File:** `src/app/shows/[id]/page.tsx` (584 lines)

**Problem 1: Judge Assignment Banner (line 168)** has a gradient `bg-gradient-to-br from-[rgba(139,92,246,0.15)] to-[rgba(245,158,11,0.1)]` that clashes.
```diff
- className="animate-fade-in-up mb-6 rounded-lg border border-[rgba(139,92,246,0.3)] bg-gradient-to-br from-[rgba(139,92,246,0.15)] to-[rgba(245,158,11,0.1)] p-6 text-center shadow-md transition-all"
+ className="animate-fade-in-up mb-6 rounded-xl border border-stone-200 bg-white p-6 text-center shadow-sm"
```

**Problem 2: Entry Form wrapper (line 190)** has a blue `rgba` tint:
```diff
- className="bg-[rgba(129,140,248,0.04)] border-[rgba(129,140,248,0.15)] animate-fade-in-up mb-8 rounded-lg border p-6"
+ className="animate-fade-in-up mb-8 rounded-xl border border-stone-200 bg-white p-6 shadow-sm"
```

**Problem 3: Results wrapper (line 274)** uses `bg-card border-edge`:
```diff
- className="bg-card border-edge animate-fade-in-up rounded-lg border p-8 mb-6 shadow-md transition-all"
+ className="animate-fade-in-up rounded-xl border border-stone-200 bg-white p-8 mb-6 shadow-sm"
```

**Problem 4: Judging banner (lines 420-427)** uses inline styles with `rgba` yellow tint:
Replace the entire element. Remove the `style={{...}}` prop and clean the classes:
```diff
- className="bg-card border-edge animate-fade-in-up rounded-lg border shadow-md transition-all"
- style={{ textAlign:"center", padding:"var(--space-lg)", marginBottom:"var(--space-lg)", background:"rgba(245, 158, 11, 0.1)", border:"1px solid rgba(245, 158, 11, 0.3)" }}
+ className="animate-fade-in-up mb-6 rounded-xl border border-stone-200 bg-white p-8 text-center shadow-sm"
```
(Remove the `style` prop entirely.)

**Problem 5: Empty state (line 477)** uses `bg-card border-edge`:
```diff
- className="bg-card border-edge animate-fade-in-up rounded-lg border px-8 py-12 text-center shadow-md transition-all"
+ className="animate-fade-in-up rounded-xl border border-stone-200 bg-white px-8 py-12 text-center shadow-sm"
```

**Problem 6: Entries list container (line 483):**
```diff
- className="border-[var(--color-border, rgba(0, 0, 0, 0.06))] animate-fade-in-up flex flex-col gap-0 overflow-hidden rounded-lg border"
+ className="animate-fade-in-up flex flex-col gap-0 overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm"
```

**Problem 7: Entry row borders (line 487):**
```diff
- className="border-[var(--color-border, rgba(0, 0, 0, 0.06))] flex items-center gap-4 border-b px-6 py-4 transition-colors"
+ className="flex items-center gap-4 border-b border-stone-100 px-6 py-4 transition-colors last:border-b-0 hover:bg-stone-50"
```

**Problem 8: Champion banners (line 282):**
```diff
- className="animate-fade-in-up mb-4 rounded-lg border border-amber-200/30 bg-amber-50/30 p-4 text-center"
+ className="animate-fade-in-up mb-4 rounded-lg border border-amber-200 bg-amber-50 p-4 text-center"
```
(Keep amber tint but make it solid, not transparent.)

### Task 2.3: Clean Up the Dashboard Sidebar Widgets
**Target Files:** `src/components/NanDashboardWidget.tsx`, `src/components/ShowHistoryWidget.tsx`

**NanDashboardWidget.tsx:**
The widget (line 17) uses a `<details>` tag with legacy CSS classes.
```diff
- <details className="nan-dashboard-widget" id="nan-dashboard">
+ <details className="rounded-xl border border-stone-200 bg-white p-6 shadow-sm" id="nan-dashboard">
```
The summary (line 18) is hidden. Clean its styling:
```diff
- <summary className="hidden">
+ <summary className="flex cursor-pointer list-none items-center gap-2 text-base font-bold text-stone-900 select-none [&::-webkit-details-marker]:hidden">
```
(Note: the `hidden` class is intentional — this summary is never shown. Verify this is correct before changing.)

The inner link (line 61-66):
```diff
- className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
+ className="mt-4 inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-lg border border-stone-200 bg-white px-6 py-2 text-sm font-semibold text-stone-600 no-underline transition-all hover:bg-stone-50"
```

**ShowHistoryWidget.tsx (line 57):**
```diff
- className="mt-6 rounded-lg border border-[rgba(139,92,246,0.15)] bg-[linear-gradient(135deg,rgba(139,92,246,0.06),rgba(245,158,11,0.04))] p-2"
+ className="mt-6 rounded-xl border border-stone-200 bg-white p-4 shadow-sm"
```

The summary (line 60):
```diff
- className="text-ink flex cursor-pointer list-none items-center gap-2 px-4 py-2 text-base font-bold select-none [&::-webkit-details-marker]:hidden"
+ className="flex cursor-pointer list-none items-center gap-2 px-2 py-2 text-base font-bold text-stone-900 select-none [&::-webkit-details-marker]:hidden"
```

The year buttons (line 72) — strip the purple rgba hover:
```diff
- hover:bg-[rgba(139,92,246,0.08)] ${expandedYear === year ?"bg-[rgba(139,92,246,0.06)]" :""}
+ hover:bg-stone-50 ${expandedYear === year ?"bg-stone-50" :""}
```

// turbo
6. Build: `npx next build`
// turbo
7. Test: `npx vitest run`
8. Commit: `git add -A && git commit -m "feat(ui): Phase 4.2 — flatten DOM, strip nested boxes from add-horse, shows, dashboard widgets"`

> ### 🛑 HUMAN VERIFICATION GATE 2 🛑
> **Agent Instructions:** Halt execution. Do NOT proceed until the human developer says **"Phase 2 Verified. Proceed to Phase 3."**
> - [ ] Go to `/add-horse`. Are the duplicate nested green borders gone? Each step should be a single white card.
> - [ ] Go to a Photo Show page. Are the purple/yellow/pink rgba boxes gone, replaced by clean white cards?
> - [ ] Dashboard sidebar: are the NAN and Show History widgets clean white cards instead of purple-gradient tinted boxes?

---

## 📋 PHASE 3: The Catalog & Table Rescue

**Problem:** The CatalogBrowser and StableLedger use raw `<table>` elements with custom CSS classes (`ref-table`, `ref-browser`, `border-edge`) that float unstyled on the page background. They need proper containment and shadcn Table components.

### Task 3.1: Install shadcn Table Component
// turbo
9. Run: `npx shadcn@latest add table --yes`

Verify the component was created at `src/components/ui/table.tsx`.

### Task 3.2: Refactor CatalogBrowser to Use shadcn Table
**Target File:** `src/components/CatalogBrowser.tsx` (307 lines)

**Step A — Add imports:**
```tsx
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card"; // install if not present
```
If `card.tsx` doesn't exist yet, run `npx shadcn@latest add card --yes` first.

**Step B — Wrap in Card:**
Replace the outer `<div className="ref-browser">` (line 133):
```diff
- <div className="ref-browser">
+ <Card className="w-full overflow-hidden border-stone-200 bg-white shadow-sm">
```
Closing `</div>` at end → `</Card>`.

**Step C — Style the filter bar:**
Replace the search container:
```diff
- <div className="relative mb-4">
-   <input id="catalog-search" type="text" className="input text-muted" ...
+ <div className="border-b border-stone-100 bg-stone-50/50 p-6">
+   <Input id="catalog-search" type="text" className="w-full" ...
```
Import `Input` from `@/components/ui/input`.

**Step D — Replace raw `<table>` with shadcn Table:**
Replace `<div className="ref-table-wrap">` and its `<table className="ref-table">` (lines 210-211):
```diff
- <div className="ref-table-wrap">
-   <table className="ref-table">
-     <thead>
-       <tr>
-         <th className="border-edge text-muted cursor-pointer border-b-[2px] p-2 ...">
+ <div className="overflow-x-auto">
+   <Table>
+     <TableHeader>
+       <TableRow className="hover:bg-transparent">
+         <TableHead className="cursor-pointer select-none whitespace-nowrap text-stone-500" onClick={() => handleSort("title")}>
```

Replace all `<th>` → `<TableHead>`, `<tr>` → `<TableRow>`, `<td>` → `<TableCell>`, `<thead>` → `<TableHeader>`, `<tbody>` → `<TableBody>`.

For each `<TableHead>`, use: `className="cursor-pointer select-none whitespace-nowrap text-stone-500"` (for sortable) or just `className="whitespace-nowrap text-stone-500"` (for non-sortable).

For each `<TableRow>` in the body: `className="cursor-pointer transition-colors hover:bg-stone-50"`.

For each `<TableCell>`:
- Primary column (Name): `className="font-medium text-stone-900"`
- Other columns: `className="text-stone-600"`

Strip all `border-edge border-b` classes from cells — the shadcn Table handles borders automatically.

Close with `</Table>` instead of `</table>`, `</div>` instead of `</div>`.

### Task 3.3: Refactor StableLedger to Use shadcn Table
**Target File:** `src/components/StableLedger.tsx` (301 lines)

Apply the same treatment:

**Step A — Add imports:**
```tsx
import {
  Table, TableBody, TableCell, TableHead, TableHeader, TableRow,
} from "@/components/ui/table";
```

**Step B — Replace the empty state (line 164):**
```diff
- <div className="bg-card border-edge rounded-lg border px-8 py-12 text-center shadow-md transition-all">
+ <div className="rounded-xl border border-stone-200 bg-white px-8 py-12 text-center shadow-sm">
```

**Step C — Replace table container (line 170):**
```diff
- <div className="border-edge bg-surface-primary overflow-x-auto rounded-lg border">
-   <table className="w-full border-collapse text-sm">
-     <thead>
-       <tr>
+ <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
+   <Table>
+     <TableHeader>
+       <TableRow className="hover:bg-transparent">
```

Replace all `<th>` → `<TableHead>`, `<tr>` → `<TableRow>`, `<td>` → `<TableCell>`, `<thead>` → `<TableHeader>`, `<tbody>` → `<TableBody>`, `</table>` → `</Table>`.

For each `<TableHead>`, add: `className="cursor-pointer select-none whitespace-nowrap text-stone-500 hover:text-forest transition-colors"`.

For the body `<TableRow>` (line 228-231), strip the legacy classes:
```diff
- className={`hover:bg-surface-secondary transition-colors ${selectMode && selectedIds.has(horse.id) ?"!bg-[rgba(44,85,69,0.1)]" :""} ...`}
+ className={`transition-colors hover:bg-stone-50 ${selectMode && selectedIds.has(horse.id) ?"bg-forest/5" :""} ${selectMode ? "cursor-pointer" : ""}`}
```

Replace the legacy badge function `getFinishBadgeClass` (lines 28-40) with shadcn Badge:
```tsx
import { Badge } from "@/components/ui/badge";
```
And in the render, replace the span with:
```tsx
<Badge variant="secondary" className="text-xs">{horse.finishType || "—"}</Badge>
```

Strip `bg-[rgba(...)]` trade status badges (lines 277, 282) — use shadcn Badge:
```tsx
<Badge variant="secondary" className="bg-emerald-50 text-emerald-700 text-xs">💲 For Sale</Badge>
<Badge variant="secondary" className="bg-amber-50 text-amber-700 text-xs">🤝 Offers</Badge>
```

// turbo
10. Build: `npx next build`
// turbo
11. Test: `npx vitest run`
12. Commit: `git add -A && git commit -m "feat(ui): Phase 4.3 — shadcn Table for CatalogBrowser and StableLedger"`

> ### 🛑 FINAL HUMAN VERIFICATION GATE 3 🛑
> **Agent Instructions:** Halt execution. Do NOT proceed until the human developer says **"Phase 3 Verified. UI Rescue Complete."**
> - [ ] Go to the Catalog page. Is it inside a crisp white Card with a beautifully formatted shadcn Table?
> - [ ] Go to Dashboard, switch to Ledger view. Is the table clean with proper hover states?
> - [ ] Do all finish/trade badges use shadcn Badge with clean colors?

---

## Final Cleanup

// turbo
13. Run full build: `npx next build`
// turbo
14. Run full tests: `npx vitest run`
15. Final commit: `git add -A && git commit -m "feat(ui): Phase 4 complete — Quiet Luxury DOM Flattening"`
16. Push: `git push origin main` (only after all gates passed)

---

## Reference: Files Modified in This Workflow

| Phase | File | Change Type |
|---|---|---|
| 1.1 | `src/app/globals.css` | Color variables → stone-50 palette |
| 1.2 | `src/components/Footer.tsx` | Dark brown → white/stone footer |
| 2.1 | `src/app/add-horse/page.tsx` | Strip 4× triple-nested card wrappers |
| 2.2 | `src/app/shows/[id]/page.tsx` | Strip rgba tints, clean card wrappers |
| 2.3 | `src/components/NanDashboardWidget.tsx` | Clean card wrapper |
| 2.3 | `src/components/ShowHistoryWidget.tsx` | Strip purple gradient, clean card |
| 3.1 | `src/components/ui/table.tsx` | New: shadcn Table component |
| 3.1 | `src/components/ui/card.tsx` | New: shadcn Card component (if needed) |
| 3.2 | `src/components/CatalogBrowser.tsx` | Card + shadcn Table refactor |
| 3.3 | `src/components/StableLedger.tsx` | Card + shadcn Table + Badge refactor |
