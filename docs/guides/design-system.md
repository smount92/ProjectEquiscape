# Model Horse Hub — Design System Guide

## Core Philosophy: "The Cozy Scrapbook"

MHH should feel warm, tactile, physical, and hobby-focused. Think of a beautifully maintained scrapbook or ledger — not a sterile SaaS dashboard. Every page should feel like it belongs in a collector's den.

## Typography

| Element | Font | Classes | Notes |
|---------|------|---------|-------|
| Page titles, H1, H2, Hero | Playfair Display | `font-serif text-3xl md:text-4xl font-bold tracking-tight` | Loaded as `--font-serif-theme` |
| H3, Section headers | Playfair Display | `font-serif text-xl font-semibold` | |
| UI text, labels, buttons | Inter | `font-sans text-sm` or `text-base` | Default body font |
| Muted/secondary | Inter | `text-stone-500` | Never use pure `#000` black |
| Primary text | Inter | `text-stone-900` | Warm dark |
| Light secondary | Inter | `text-stone-600` | For descriptions, metadata |

## Color Palette

> **Migration complete (2026-03-28):** All legacy semantic tokens (`bg-card`, `border-edge`, `text-ink`, `text-muted`, etc.) have been replaced with Tailwind stone palette equivalents across all 55+ pages and 90+ components.

| Tailwind Class | Usage | Replaces Legacy Token |
|----------------|-------|-----------------------|
| `bg-stone-50` | Page backgrounds, elevated surfaces | `bg-parchment`, `bg-elevated`, `bg-glass` |
| `bg-white` | Card surfaces, input backgrounds | `bg-card` |
| `bg-stone-100` | Section dividers, sticky headers | `bg-parchment-dark` |
| `text-stone-900` | Primary text | `text-ink` |
| `text-stone-600` | Secondary text, descriptions | `text-ink-light` |
| `text-stone-500` | Muted text, hints, metadata | `text-muted` |
| `text-white` | Inverse text on dark backgrounds | `text-inverse` |
| `border-stone-200` | All structural borders | `border-edge` |
| `text-forest` / `bg-forest` | Primary accent (Hunter Green `#2C5545`) | Unchanged |
| `text-red-700` | Destructive action text | `text-danger` |
| `bg-emerald-500` | Success backgrounds | `bg-success` |
| `bg-emerald-50` | Success state surfaces | RGBA emerald patterns |
| `bg-amber-50` | Warning state surfaces | RGBA amber patterns |
| `bg-red-50` | Error state surfaces | RGBA red patterns |
| `bg-purple-50` | Art Studio accent surfaces | RGBA purple patterns |

### ❌ Banned Legacy Tokens

The following class names **must never be used** in new code:

```
bg-card, bg-glass, bg-elevated, bg-parchment, bg-parchment-dark, bg-surface-glass
border-edge, text-ink, text-ink-light, text-muted, text-inverse, text-danger
bg-success, bg-surface-primary, bg-surface-secondary
```

Any `bg-[rgba(...)]` or `border-[rgba(...)]` patterns should use Tailwind palette equivalents (e.g., `bg-emerald-50` instead of `bg-[rgba(44,85,69,0.1)]`).

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

### Intentional Exceptions

Two pages intentionally bypass the layout archetype system:
- **`page.tsx` (Landing page):** Full-bleed marketing page with per-section `max-w-*` constraints
- **`inbox/[id]/page.tsx` (Chat):** Full-viewport chat shell using `h-[calc(100vh-var(--header-height))]`

### Migration Status: ✅ COMPLETE (2026-03-28)

All 55+ `page.tsx` files and 90+ components have been migrated. Zero legacy tokens remain in TSX/TS files.

**When creating a new page:** Import the appropriate layout component from `@/components/layouts/` and wrap your page content. Never create custom `mx-auto max-w-[...]` container divs.

```tsx
// ✅ Correct:
import ExplorerLayout from "@/components/layouts/ExplorerLayout";
export default function MyPage() {
    return <ExplorerLayout title="My Page">...</ExplorerLayout>;
}

// ❌ Forbidden:
export default function MyPage() {
    return <div className="mx-auto max-w-7xl px-6">...</div>;
}
```
