---
description: UI Overhaul Part 1 — Install shadcn/ui + Framer Motion tooling, then systematically replace all form-input/form-select usages with shadcn primitives across all pages and components.
---

# UI Overhaul Part 1: Tooling & Form Primitives

> **Source Plan:** `.agents/docs/UI_Update_Plan.md` (Phases 1.1–1.3)
> **Scope:** Install shadcn/ui + Framer Motion, configure theme, replace all `form-input` / `form-select` with shadcn `<Input>` / `<Select>` / `<Textarea>` / `<Button>`
> **Last Updated:** 2026-03-25

// turbo-all

## Pre-flight

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1" | Select-Object -Last 5
```

```
cd c:\Project Equispace\model-horse-hub && npx vitest run 2>&1 | Select-Object -Last 5
```

---

# ═══════════════════════════════════════
# TASK 1: Install & Initialize Tooling
# ═══════════════════════════════════════

### Step 1.1: Install dependencies

```
cd c:\Project Equispace\model-horse-hub && npm install framer-motion clsx tailwind-merge
```

### Step 1.2: Initialize shadcn/ui

First check available options:
```
cd c:\Project Equispace\model-horse-hub && npx shadcn@latest init --help
```

Then initialize (select: New York style, Stone base, CSS variables yes):
```
cd c:\Project Equispace\model-horse-hub && npx shadcn@latest init
```

> **IMPORTANT:** If shadcn prompts for Tailwind version, select Tailwind v4. If it creates a `tailwind.config.ts` or modifies `globals.css`, review the diff carefully — do NOT let it overwrite the existing `@theme` block or design tokens.

### Step 1.3: Install core shadcn components

```
cd c:\Project Equispace\model-horse-hub && npx shadcn@latest add button input select textarea badge skeleton separator
```

### Step 1.4: Create the `cn()` utility

Create `src/lib/utils/cn.ts`:

```typescript
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
    return twMerge(clsx(inputs));
}
```

> **Note:** shadcn may create its own `lib/utils.ts` with `cn()`. If so, consolidate — keep only one `cn()` export.

### Step 1.5: Verify installation

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1" | Select-Object -Last 5
```

Check that `src/components/ui/` exists with the installed components.

---

# ═══════════════════════════════════════
# TASK 2: Replace form-input with shadcn <Input>
# ═══════════════════════════════════════

## Strategy

Replace all `className="form-input ..."` with shadcn `<Input>` components. Work in batches with build verification after each.

**Import pattern for every file:**
```typescript
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
```

**Replacement pattern:**
```tsx
// BEFORE:
<input className="form-input" type="text" ... />

// AFTER:
<Input type="text" ... />
```

```tsx
// BEFORE:
<textarea className="form-input" ... />

// AFTER:
<Textarea ... />
```

```tsx
// BEFORE:
<select className="form-select" ...>

// AFTER:
// Use shadcn <Select> for complex selects, or just replace the class:
<select className="flex h-10 w-full rounded-md border border-edge bg-card px-3 py-2 text-sm" ...>
```

> **IMPORTANT:** For `<select>` elements with dynamic option lists (e.g., horse dropdowns), keep native `<select>` but replace the `form-select` class with Tailwind utilities. shadcn `<Select>` uses Radix and doesn't support dynamic children as easily. Use shadcn `<Select>` only for small, static option sets.

---

### Batch A: Auth Pages (5 files)

These are simple forms — lowest risk, good warmup.

| File | Elements |
|------|----------|
| `src/app/login/page.tsx` | email input, password input, submit button |
| `src/app/signup/page.tsx` | alias input, email, password, confirm, submit |
| `src/app/forgot-password/page.tsx` | email input, submit |
| `src/app/auth/reset-password/page.tsx` | password inputs, submit |
| `src/app/contact/page.tsx` | name, email, message textarea, submit |

**Build check:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1" | Select-Object -Last 5
```

---

### Batch B: Core Pages (5 files)

| File | Elements |
|------|----------|
| `src/app/add-horse/page.tsx` | Multi-step form — inputs, selects, textareas across all steps |
| `src/app/add-horse/quick/page.tsx` | Quick-add form — name input, select |
| `src/app/stable/[id]/edit/page.tsx` | Edit form — all horse fields |
| `src/app/settings/page.tsx` | Profile settings — alias, bio, currency select, toggles |
| `src/app/claim/page.tsx` | Claim form — PIN input |

**Build check:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1" | Select-Object -Last 5
```

---

### Batch C: Community & Studio Pages (5 files)

| File | Elements |
|------|----------|
| `src/app/community/events/create/page.tsx` | Event creation form |
| `src/app/community/events/[id]/manage/page.tsx` | Event management — selects, inputs |
| `src/app/community/groups/create/page.tsx` | Group creation form |
| `src/app/studio/setup/page.tsx` | Studio setup — slug, bio, specialties |
| `src/app/catalog/suggestions/new/page.tsx` | Catalog suggestion form |

**Build check:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1" | Select-Object -Last 5
```

---

### Batch D: Components with form-input (34 files)

Work through these in alphabetical order. For each file:
1. Add `import { Input } from "@/components/ui/input"` (and Textarea/Button as needed)
2. Replace `<input className="form-input ..."` → `<Input ...`
3. Replace `<textarea className="form-input ..."` → `<Textarea ...`
4. Replace `<select className="form-select ..."` → native select with Tailwind classes

| Component | Notes |
|-----------|-------|
| `AdminShowManager.tsx` | |
| `ArtistBrowser.tsx` | Has form-select |
| `AssignPlacings.tsx` | |
| `CollectionManager.tsx` | |
| `CollectionPicker.tsx` | |
| `CommissionRequestForm.tsx` | |
| `CommissionTimeline.tsx` | |
| `CreateShowForm.tsx` | |
| `DashboardShell.tsx` | Has form-select for sort |
| `DiscoverGrid.tsx` | |
| `EditBioButton.tsx` | |
| `EventBrowser.tsx` | |
| `ExpertJudgingPanel.tsx` | |
| `FeatureHorseForm.tsx` | |
| `GroupBrowser.tsx` | |
| `GroupFiles.tsx` | |
| `GroupRegistry.tsx` | |
| `HelpIdDetailClient.tsx` | |
| `HelpIdRequestForm.tsx` | |
| `HoofprintTimeline.tsx` | |
| `InsuranceReportButton.tsx` | Has form-select |
| `LinkHorseToCommission.tsx` | |
| `MakeOfferModal.tsx` | |
| `MarketFilters.tsx` | |
| `PedigreeCard.tsx` | |
| `RatingForm.tsx` | |
| `ReportButton.tsx` | |
| `ShowEntryForm.tsx` | |
| `ShowRecordForm.tsx` | Has form-select |
| `ShowRingGrid.tsx` | |
| `ShowStringManager.tsx` | |
| `StableGrid.tsx` | |
| `SuggestNewEntryForm.tsx` | |
| `SuggestReferenceModal.tsx` | |
| `TransferModal.tsx` | |
| `UniversalFeed.tsx` | |
| `GroupAdminPanel.tsx` | Has form-select |

**Build check after every ~8 files:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1" | Select-Object -Last 5
```

---

### Step 2.5: Clean up globals.css

After ALL consumers have been migrated, remove the legacy `.form-input`, `.form-select`, and `.form-textarea` definitions from `src/app/globals.css` (currently around lines 277–312). Also remove the simple-mode overrides for these classes (lines 164–168).

**Build check:**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1" | Select-Object -Last 5
```

---

# ═══════════════════════════════════════
# FINAL VERIFICATION
# ═══════════════════════════════════════

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1" | Select-Object -Last 5
```

```
cd c:\Project Equispace\model-horse-hub && npx vitest run
```

Check that:
- [ ] `src/components/ui/` contains: `button.tsx`, `input.tsx`, `select.tsx`, `textarea.tsx`, `badge.tsx`, `skeleton.tsx`, `separator.tsx`
- [ ] No remaining `form-input` class in any `.tsx` file
- [ ] No remaining `form-select` class in any `.tsx` file
- [ ] `.form-input` / `.form-select` removed from `globals.css`
- [ ] Build passes cleanly
- [ ] All tests pass

```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "feat(ui): install shadcn/ui + framer-motion, replace all form-input/form-select with shadcn primitives"
```
