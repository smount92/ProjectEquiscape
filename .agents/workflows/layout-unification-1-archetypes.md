---
description: Layout Unification Part 1 — Create Design System documentation, build the 4 page archetype layout components (Explorer, Scrapbook, CommandCenter, Focus), and validate with build.
---

# Layout Unification Part 1: Design System & Layout Archetypes

> ## ✅ STATUS: COMPLETE (2026-03-27)
> Design system docs created. 4 layout archetype components built and validated. Build passes.

> **Source Plan:** `.agents/docs/Layout_Unification.md` (Phases 1–2)
> **Scope:** Create design system docs, build 4 layout wrapper components
> **Last Updated:** 2026-03-27

// turbo-all

## Pre-flight

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1" | Select-Object -Last 5
```

---

# ═══════════════════════════════════════
# TASK 1: Design System Documentation
# ═══════════════════════════════════════

### Step 1.1: Create the Design System Guide

Create file `docs/guides/design-system.md` with the following comprehensive content:

```markdown
# Model Horse Hub — Design System Guide

## Core Philosophy: "The Cozy Scrapbook"

MHH should feel warm, tactile, physical, and hobby-focused. Think of a beautifully maintained scrapbook or ledger — not a sterile SaaS dashboard. Every page should feel like it belongs in a collector's den.

## Typography

| Element | Font | Classes | Notes |
|---------|------|---------|-------|
| Page titles, H1, H2, Hero | Playfair Display | `font-serif text-3xl md:text-4xl font-bold tracking-tight` | Loaded as `--font-serif-theme` |
| H3, Section headers | Playfair Display | `font-serif text-xl font-semibold` | |
| UI text, labels, buttons | Inter | `font-sans text-sm` or `text-base` | Default body font |
| Muted/secondary | Inter | `text-muted` or `text-stone-600` | Never use pure `#000` black |
| Primary text | Inter | `text-ink` or `text-stone-900` | Espresso, warm dark |

## Color Palette

| Token | Value | Usage |
|-------|-------|-------|
| `parchment` | `#F0EAD6` | Page backgrounds |
| `card` | `#FBF7ED` | Card surfaces |
| `ink` | `#2D2318` | Primary text (NOT black) |
| `muted` | `#8B7B6A` | Secondary/helper text |
| `forest` | `#2C5545` | Primary accent, CTAs |
| `saddle` | `#8B5A2B` | Secondary accent |
| `edge` | `#D4C9B5` | Borders |
| `danger` | `#9B3028` | Destructive actions |
| `success` | `#356845` | Positive states |

## Spacing Rules

- Strict 8-point grid: `p-2` (8px), `p-4` (16px), `p-6` (24px), `p-8` (32px)
- Standard gap: `gap-6` for cards, `gap-8` for sections
- NO arbitrary spacing values (e.g., `p-[13px]`)
- NO nested borders ("boxes within boxes") — use background contrast or subtle dividers

## Component Rules

1. **Inputs:** Always use `<Input>` / `<Textarea>` from `@/components/ui/`
2. **Buttons:** Always use `<Button>` from `@/components/ui/button`
3. **Modals:** Always use `<Dialog>` from `@/components/ui/dialog`
4. **Badges:** Always use `<Badge>` from `@/components/ui/badge`
5. **Never** use inline `style={{...}}` for layout, padding, or colors
6. **Never** create custom page container divs — use Layout Archetypes

## The 4 Page Archetypes

### 1. ExplorerLayout — Browsing Grids
- **Max width:** `max-w-7xl` (1280px)
- **Use for:** Community/Show Ring, Discover, Market, Catalog, Shows, Groups
- **Structure:** Title + Controls (sticky) + Grid content
- **Key feature:** Sticky filters bar with backdrop blur

### 2. ScrapbookLayout — Split-View Details
- **Max width:** `max-w-7xl` (1280px)
- **Use for:** Horse Passport, Studio Profile, Event Detail
- **Structure:** Breadcrumbs + Left (gallery/timeline) + Right (sticky data card)
- **Grid:** `grid-cols-[1.5fr_1fr]` with right column sticky

### 3. CommandCenterLayout — High-Density Dashboards
- **Max width:** `max-w-[1600px]`
- **Use for:** Digital Stable (Dashboard), Admin Console
- **Structure:** Title + Main content + Sidebar
- **Grid:** `grid-cols-[1fr_320px]`

### 4. FocusLayout — Data Entry & Forms
- **Max width:** `max-w-2xl` (672px)
- **Use for:** Add Horse, Edit Horse, Settings, Login, Signup, Contact, Claim
- **Structure:** Back link + Title + Centered form content
```

### Step 1.2: Update CONTRIBUTING.md

If `CONTRIBUTING.md` or `docs/README.md` exists, add a "Design System" section. If no CONTRIBUTING file exists, add the rules to `docs/README.md`:

Add this section:

```markdown
## Design System

All UI work MUST follow the Design System Guide: [`docs/guides/design-system.md`](guides/design-system.md)

### Hard Rules
1. **No custom page containers.** Every page must use one of the 4 Layout Archetypes (`ExplorerLayout`, `ScrapbookLayout`, `CommandCenterLayout`, `FocusLayout`).
2. **No inline styles.** `style={{...}}` is forbidden for layout, padding, or colors.
3. **Use shadcn/ui components.** Raw `<input>`, `<select>`, `<button>` elements are forbidden except inside shadcn component primitives.
4. **No pure black text.** Use `text-ink` or `text-stone-900`, never `text-black` or `#000`.
```

**Build check (docs don't affect build, but verify anyway):**
```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1" | Select-Object -Last 5
```

---

# ═══════════════════════════════════════
# TASK 2: Build the 4 Layout Components
# ═══════════════════════════════════════

### Step 2.1: Create the layouts directory

```
cd c:\Project Equispace\model-horse-hub && mkdir src\components\layouts
```

### Step 2.2: Build `ExplorerLayout.tsx`

Create `src/components/layouts/ExplorerLayout.tsx`:

```tsx
"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface ExplorerLayoutProps {
    title: ReactNode;
    description?: ReactNode;
    headerActions?: ReactNode;
    controls?: ReactNode;
    children: ReactNode;
}

export default function ExplorerLayout({
    title,
    description,
    headerActions,
    controls,
    children,
}: ExplorerLayoutProps) {
    return (
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 md:py-12 lg:px-8">
            {/* Header row */}
            <div className="mb-6 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="font-serif text-3xl font-bold tracking-tight text-ink md:text-4xl">
                        {title}
                    </h1>
                    {description && (
                        <p className="mt-1 text-muted">{description}</p>
                    )}
                </div>
                {headerActions && <div className="flex gap-3">{headerActions}</div>}
            </div>

            {/* Controls row (sticky) */}
            {controls && (
                <div className="sticky top-[calc(var(--header-height)+1rem)] z-40 mb-8 border-b border-stone-200 bg-parchment/90 pb-4 pt-2 backdrop-blur-md">
                    {controls}
                </div>
            )}

            {/* Content — animated */}
            <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
            >
                {children}
            </motion.div>
        </div>
    );
}
```

### Step 2.3: Build `ScrapbookLayout.tsx`

Create `src/components/layouts/ScrapbookLayout.tsx`:

```tsx
"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface ScrapbookLayoutProps {
    breadcrumbs?: ReactNode;
    leftContent: ReactNode;
    rightContent: ReactNode;
    belowContent?: ReactNode;
}

export default function ScrapbookLayout({
    breadcrumbs,
    leftContent,
    rightContent,
    belowContent,
}: ScrapbookLayoutProps) {
    return (
        <div className="mx-auto w-full max-w-7xl px-4 py-8 sm:px-6 md:py-12 lg:px-8">
            {breadcrumbs && <div className="mb-6">{breadcrumbs}</div>}

            <motion.div
                className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1.5fr_1fr] lg:gap-12"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
            >
                {/* Left: Gallery / Timeline */}
                <div className="flex flex-col gap-8">{leftContent}</div>

                {/* Right: Data card (sticky on desktop) */}
                <div className="flex flex-col gap-6 lg:sticky lg:top-[calc(var(--header-height)+2rem)]">
                    {rightContent}
                </div>
            </motion.div>

            {belowContent && <div className="mt-12">{belowContent}</div>}
        </div>
    );
}
```

### Step 2.4: Build `CommandCenterLayout.tsx`

Create `src/components/layouts/CommandCenterLayout.tsx`:

```tsx
"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface CommandCenterLayoutProps {
    title: ReactNode;
    description?: ReactNode;
    headerActions?: ReactNode;
    mainContent: ReactNode;
    sidebarContent?: ReactNode;
}

export default function CommandCenterLayout({
    title,
    description,
    headerActions,
    mainContent,
    sidebarContent,
}: CommandCenterLayoutProps) {
    return (
        <div className="mx-auto w-full max-w-[1600px] px-4 py-8 sm:px-6 md:py-12 lg:px-8">
            {/* Header row */}
            <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div>
                    <h1 className="font-serif text-3xl font-bold tracking-tight text-ink md:text-4xl">
                        {title}
                    </h1>
                    {description && (
                        <p className="mt-1 text-muted">{description}</p>
                    )}
                </div>
                {headerActions && <div className="flex gap-3">{headerActions}</div>}
            </div>

            {/* Dashboard grid */}
            <motion.div
                className="grid grid-cols-1 items-start gap-8 lg:grid-cols-[1fr_320px] 2xl:grid-cols-[1fr_360px]"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
            >
                <main className="flex min-w-0 flex-col gap-8">{mainContent}</main>
                {sidebarContent && (
                    <aside className="flex flex-col gap-6">{sidebarContent}</aside>
                )}
            </motion.div>
        </div>
    );
}
```

### Step 2.5: Build `FocusLayout.tsx`

Create `src/components/layouts/FocusLayout.tsx`:

```tsx
"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface FocusLayoutProps {
    title: ReactNode;
    description?: ReactNode;
    backLink?: ReactNode;
    children: ReactNode;
}

export default function FocusLayout({
    title,
    description,
    backLink,
    children,
}: FocusLayoutProps) {
    return (
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-8 px-4 py-12 sm:px-6 md:py-16">
            {backLink && <div>{backLink}</div>}

            <div>
                <h1 className="font-serif text-3xl font-bold tracking-tight text-ink md:text-4xl">
                    {title}
                </h1>
                {description && (
                    <p className="mt-2 text-muted">{description}</p>
                )}
            </div>

            <motion.div
                className="w-full"
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3, ease: "easeOut" }}
            >
                {children}
            </motion.div>
        </div>
    );
}
```

### Step 2.6: Create barrel export

Create `src/components/layouts/index.ts`:

```typescript
export { default as ExplorerLayout } from "./ExplorerLayout";
export { default as ScrapbookLayout } from "./ScrapbookLayout";
export { default as CommandCenterLayout } from "./CommandCenterLayout";
export { default as FocusLayout } from "./FocusLayout";
```

### Step 2.7: Build and verify

```
cd c:\Project Equispace\model-horse-hub && cmd /c "npx next build 2>&1" | Select-Object -Last 5
```

```
cd c:\Project Equispace\model-horse-hub && npx vitest run
```

Check that:
- [x] `src/components/layouts/` contains 5 files (4 components + index.ts)
- [x] `docs/guides/design-system.md` exists with full content
- [x] Build passes cleanly
- [x] All tests pass

```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "feat(ui): design system docs + 4 page archetype layout components (Explorer, Scrapbook, CommandCenter, Focus)"
```
