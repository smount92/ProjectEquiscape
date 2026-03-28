---
description: Restore the Warm Parchment aesthetic — color tokens, shadows, typography, header/footer
---

# Warm Parchment Aesthetic Restoration

> **Objective:** Restore the warm, tactile "Parchment & Espresso" color palette across the application. The layout unification produced a clean DOM but the resulting `stone-50`/pure-white palette feels sterile for a collector community.
> **Last Updated:** 2026-03-28
> **Critical Rule:** DO NOT alter DOM structure, grid layouts, or component logic. This is PURELY colors, fonts, shadows, and text sizes.

// turbo-all

---

# ═══════════════════════════════════════
# PHASE 1: The Global Color Token Swap
# ═══════════════════════════════════════

## Step 1.1 — Update the @theme block color tokens

**Target File:** `src/app/globals.css`
**Lines:** 8–51 (the `@theme { ... }` block)

Replace the current cold stone palette values in the `@theme` block with warm parchment values. The keys stay the same — only the color values change.

**Find and replace these specific values within the `@theme` block:**

| Token | Current Value | New Value | Why |
|-------|---------------|-----------|-----|
| `--color-parchment` | `#FAFAF9` | `#F4EFE6` | Warm parchment background (the signature look) |
| `--color-parchment-dark` | `#F5F5F4` | `#EAE1CD` | Slightly darker parchment for secondary surfaces |
| `--color-card` | `#FFFFFF` | `#FEFCF8` | Warm alabaster cards (subtle but not white) |
| `--color-card-hover` | `#FAFAF9` | `#FBF7F0` | Slightly deeper cream on hover |
| `--color-input` | `#FAFAF9` | `#FEFCF8` | Input backgrounds match card surface |
| `--color-elevated` | `#FFFFFF` | `#FEFCF8` | Elevated surfaces match card surface |
| `--color-ink` | `#1C1917` | `#2D2318` | Deep espresso — no pure black |
| `--color-ink-light` | `#44403C` | `#594A3C` | Warm secondary text |
| `--color-muted` | `#78716C` | `#7A6A58` | Warm mocha muted text |
| `--color-edge` | `#E7E5E4` | `#E0D5C1` | Warm almond borders |
| `--color-edge-input` | `#C5B99D` | `#D4C9B0` | Slightly lighter warm input borders |
| `--shadow-sm` | `0 1px 3px rgba(80, 60, 40, 0.08)` | `0 1px 2px 0 rgba(45, 35, 24, 0.05)` | Warm subtle shadow |
| `--shadow-md` | `0 4px 8px rgba(80, 60, 40, 0.08), 0 1px 3px rgba(80, 60, 40, 0.06)` | `0 4px 6px -1px rgba(45, 35, 24, 0.08), 0 2px 4px -2px rgba(45, 35, 24, 0.04)` | Warm medium shadow |
| `--shadow-lg` | `0 10px 20px rgba(80, 60, 40, 0.08), 0 4px 8px rgba(80, 60, 40, 0.05)` | `0 10px 15px -3px rgba(45, 35, 24, 0.08), 0 4px 6px -4px rgba(45, 35, 24, 0.04)` | Warm large shadow |

**IMPORTANT:** The `--color-forest`, `--color-forest-dark`, `--color-forest-glow`, `--color-saddle`, `--color-success`, `--color-danger`, `--color-warning`, `--color-edge-focus` tokens must NOT be changed. These accent colors are correct.

## Step 1.2 — Update the :root legacy variables

**Target File:** `src/app/globals.css`
**Lines:** 55–123 (the `:root { ... }` block inside `@layer base`)

Update the legacy CSS custom properties to match the new warm palette. These are used by the `body`, heading, and paragraph base styles.

**Find and replace these specific values:**

| Token | Current Value | New Value |
|-------|---------------|-----------|
| `--color-bg-primary` | `#FAFAF9` | `#F4EFE6` |
| `--color-bg-secondary` | `#F5F5F4` | `#EAE1CD` |
| `--color-bg-card` | `#FFFFFF` | `#FEFCF8` |
| `--color-bg-card-hover` | `#FAFAF9` | `#FBF7F0` |
| `--color-bg-input` | `#FAFAF9` | `#FEFCF8` |
| `--color-bg-elevated` | `#FFFFFF` | `#FEFCF8` |
| `--color-text-primary` | `#1C1917` | `#2D2318` |
| `--color-text-secondary` | `#44403C` | `#594A3C` |
| `--color-text-muted` | `#78716C` | `#7A6A58` |
| `--color-border` | `#E7E5E4` | `#E0D5C1` |
| `--shadow-sm/md/lg` | (same old values from @theme) | (same new values from Step 1.1) |

## Step 1.3 — Update the shadcn :root variables

**Target File:** `src/app/globals.css`
**Lines:** 2187–2220 (the second `:root` block at the bottom of the file under the `shadcn/ui theme mapping` comment)

This is critical — shadcn components (Button, Dialog, Input, Select, Badge, Card, etc.) read these variables directly. If these are cold, shadcn components will still look sterile even after Step 1.1.

**Find and replace these specific values:**

| Variable | Current Value | New Value |
|----------|---------------|-----------|
| `--background` | `#FAFAF9` | `#F4EFE6` |
| `--foreground` | `#1C1917` | `#2D2318` |
| `--card` | `#FFFFFF` | `#FEFCF8` |
| `--card-foreground` | `#1C1917` | `#2D2318` |
| `--popover` | `#FFFFFF` | `#FEFCF8` |
| `--secondary` | `#F5F5F4` | `#EAE1CD` |
| `--secondary-foreground` | `#2D2318` | `#594A3C` |
| `--muted` | `#F5F5F4` | `#EAE1CD` |
| `--muted-foreground` | `#78716C` | `#7A6A58` |
| `--accent` | `#F5F5F4` | `#EAE1CD` |
| `--accent-foreground` | `#2D2318` | `#594A3C` |
| `--border` | `#E7E5E4` | `#E0D5C1` |
| `--input` | `#E7E5E4` | `#E0D5C1` |
| `--sidebar` | `#F5F5F4` | `#EAE1CD` |
| `--sidebar-foreground` | `#2D2318` | `#594A3C` |
| `--sidebar-accent` | `#FAFAF9` | `#F4EFE6` |
| `--sidebar-accent-foreground` | `#2D2318` | `#594A3C` |
| `--sidebar-border` | `#E7E5E4` | `#E0D5C1` |

**DO NOT change:** `--primary`, `--primary-foreground`, `--destructive`, `--ring`, `--chart-*`, `--popover-foreground`, `--sidebar-primary`, `--sidebar-primary-foreground`, `--sidebar-ring`, `--radius`.

## Verify Phase 1

```
cmd /c "npx next build 2>&1 | findstr /C:error /C:Error /C:compiled"
```

Check that:
- [ ] Build compiles — no new errors introduced
- [ ] The background is warm parchment (#F4EFE6), not cold stone-50
- [ ] Cards are subtle warm cream (#FEFCF8) with warm brownish shadows
- [ ] Text is deep espresso brown (#2D2318), not harsh black
- [ ] Borders are warm almond (#E0D5C1), not cold stone-200

> ### 🛑 HUMAN VERIFICATION GATE 1 🛑
> **Halt execution.** Run `npm run dev`, open the browser, and visually inspect. Await human confirmation: **"Phase 1 Verified. Proceed to Phase 2."**

---

# ═══════════════════════════════════════
# PHASE 2: Typographic Elegance & Sizing
# ═══════════════════════════════════════

## Step 2.1 — Elevate layout wrapper description text

The layout wrappers already have `font-serif text-3xl` on their `<h1>` titles (confirmed in the existing code). The descriptions, however, need to be warmer.

**Target Files (4 files):**
- `src/components/layouts/ExplorerLayout.tsx`
- `src/components/layouts/CommandCenterLayout.tsx`
- `src/components/layouts/FocusLayout.tsx`
- `src/components/layouts/ScrapbookLayout.tsx` (no title, but check breadcrumbs)

**Action for ExplorerLayout.tsx:**
- Find: `<p className="mt-1 text-ink-light">`
- Replace with: `<p className="mt-2 max-w-2xl text-lg leading-relaxed text-muted-foreground">`

**Action for CommandCenterLayout.tsx:**
- Find: `<p className="mt-1 text-stone-500">`
- Replace with: `<p className="mt-2 max-w-2xl text-lg leading-relaxed text-muted-foreground">`

**Action for FocusLayout.tsx:**
- Find: `<p className="mt-2 text-stone-500">`
- Replace with: `<p className="mt-2 max-w-2xl text-lg leading-relaxed text-muted-foreground">`

## Step 2.2 — Update the sticky controls bar in ExplorerLayout

The controls bar currently uses cold `stone-50/stone-200` colors. Update it to use warm tokens.

**Target File:** `src/components/layouts/ExplorerLayout.tsx`
**Find:** `bg-stone-50/90`
**Replace with:** `bg-[#F4EFE6]/90`

**Find:** `border-stone-200`
**Replace with:** `border-edge`

## Step 2.3 — Ensure body has antialiased rendering

**Target File:** `src/app/layout.tsx`
**Line 70** — The `<body>` tag currently has no className.

**Find:** `<body>`
**Replace with:** `<body className="antialiased">`

This ensures subpixel font rendering on macOS/Windows for smoother serif text.

## Verify Phase 2

```
cmd /c "npx next build 2>&1 | findstr /C:error /C:Error /C:compiled"
```

Check that:
- [ ] Layout wrapper descriptions are `text-lg` with relaxed leading  
- [ ] The sticky controls bar in Explorer pages uses warm parchment  
- [ ] Body text renders with antialiased smoothing

> ### 🛑 HUMAN VERIFICATION GATE 2 🛑
> **Halt execution.** Open the Show Ring, Dashboard, and Add Horse pages. Verify serif headers and warm description text. Await: **"Phase 2 Verified. Proceed to Phase 3."**

---

# ═══════════════════════════════════════
# PHASE 3: The Header & Footer Polish
# ═══════════════════════════════════════

## Step 3.1 — Warm the header

**Target File:** `src/components/Header.tsx`

The header currently uses cold `stone-100` background and `stone-200` borders. Replace with warm parchment tones.

**Line 238 — the main `<header>` element:**
**Find:** `border-stone-200 bg-stone-100`
**Replace with:** `border-edge bg-[#EAE1CD]/90 backdrop-blur-md`

> Note: The `<header>` tag already has `border-b` so we only change the color values, not the structural classes.

**Lines 336, 427 — the desktop dropdown menus:**
**Find (both occurrences):** `border-stone-200 bg-[var(--color-bg-secondary)]`
**Replace with:** `border-edge bg-[#FEFCF8]`

**Line 511 — the mobile navigation panel:**
**Find:** `border-stone-200 bg-stone-100`
**Replace with:** `border-edge bg-[#EAE1CD]`

**Lines 255, 357, 381, 736 — icon button borders/backgrounds:**
Any `bg-stone-50 border-stone-200` on icon buttons should become:
**Replace with:** `bg-[#FEFCF8] border-edge`

**Line 658 — the mobile bottom divider:**
**Find:** `border-stone-200`
**Replace with:** `border-edge`

## Step 3.2 — Warm the footer

**Target File:** `src/components/Footer.tsx`

**Line 7 — the `<footer>` element:**
**Find:** `border-stone-200 bg-white`
**Replace with:** `border-edge bg-[#EAE1CD]`

**Line 17 — tagline text:**
**Find:** `text-stone-400`
**Replace with:** `text-muted`

**Line 47 — bottom bar:**
**Find:** `border-stone-100`
**Replace with:** `border-edge`

**Find on line 47:** `text-stone-400`
**Replace with:** `text-muted`

**Lines 23, 29, 36 — footer section headings:**
**Find (3 occurrences):** `text-stone-400`
**Replace with:** `text-muted`

**Lines 49 — bottom bar link colors:**
**Find:** `[&_a]:text-stone-400`
**Replace with:** `[&_a]:text-muted`

## Verify Phase 3 & Final Build

```
cmd /c "npx next build 2>&1 | findstr /C:error /C:Error /C:compiled"
```

```
cmd /c "npx vitest run 2>&1"
```

Check that:
- [ ] Header has warm parchment background with warm blur, not cold gray
- [ ] Footer is warm parchment, not stark white
- [ ] Dropdown menus in header have warm cream backgrounds
- [ ] Mobile menu has warm background
- [ ] All 245 tests still pass
- [ ] Build passes cleanly

> ### 🛑 FINAL HUMAN VERIFICATION GATE 🛑
> **Halt execution.** Browse the full app (landing page, dashboard, stable, shows, studio, catalog). Confirm: **"Phase 3 Verified. The Parchment is restored."**

---

## Commit

```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "style: restore Warm Parchment aesthetic — color tokens, shadows, typography, header/footer"
```
