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
| Primary text | Inter | `text-ink` | Warm dark (Espresso) |
| Light secondary | Inter | `text-ink-light` | For descriptions, metadata |
| Muted | Inter | `text-muted` | For subtle hints |

## Color Palette

> **Restoration complete (2026-03-28):** After moving to Tailwind, we implemented the **Warm Parchment Restoration**. The project officially uses custom `@theme` variables mapped in `globals.css` to ensure the app looks like a physical scrapbook, not a cold SaaS tool.

| Semantic Token / Class | Hex code | Usage |
|------------------------|----------|-------|
| `bg-[#F4EFE6]` (Parchment) | `#F4EFE6` | Main page backgrounds, elevated surfaces |
| `bg-[#FEFCF8]` (Card) | `#FEFCF8` | Primary card surfaces, input backgrounds |
| `bg-[#EAE1CD]` (Parchment Dark) | `#EAE1CD` | Section dividers, header/footer backgrounds |
| `text-ink` | `#2D2318` | Primary text (Warm Espresso) |
| `text-ink-light` | `#594A3C` | Secondary text, descriptions |
| `text-muted` | `#7A6A58` | Muted text, hints, metadata |
| `border-edge` | `#E0D5C1` | All structural borders |
| `text-forest` / `bg-forest` | `#2C5545` | Primary accent (Hunter Green) |

### ❌ Banned Utility Classes (The Cold Palette)

The following default Tailwind utility classes **must be avoided** in favor of their warm semantic counterparts:

```text
bg-white, bg-stone-50, bg-stone-100
border-stone-200, border-stone-300
text-stone-900, text-stone-600, text-stone-500, text-stone-400
```
> **Accessibility Rule:** Never use `text-stone-400` or lighter text colors on the warm `#FEFCF8` cards. Always use `text-muted` or `text-ink-light` to pass WCAG contrast ratios.

## Spacing Rules

- Strict 8-point grid: `p-2` (8px), `p-4` (16px), `p-6` (24px), `p-8` (32px)
- Standard gap: `gap-6` for cards, `gap-8` for sections
- NO arbitrary spacing values (e.g., `p-[13px]`)
- NO nested borders ("boxes within boxes") — use background contrast or subtle dividers

## Component Rules

1. **Inputs:** Use `<Input>` from `@/components/ui/` for text. **Exception:** Always use a native HTML `<input type="file" className="hidden" />` or `<input type="file" className="opacity-0 absolute inset-0 ..." />` when creating robust image galleries or dropzones so Shadcn padding does not interfere with CSS Grid styling.
2. **Buttons:** Always use `<Button>` from `@/components/ui/button`
3. **Modals:** Always use `<Dialog>` from `@/components/ui/dialog`
4. **Badges:** Always use `<Badge>` from `@/components/ui/badge`
5. **Accessibility (ARIA):** Boolean `aria-expanded` and `aria-pressed` attributes must be explicitly cast to string literals (`"true"`/`"false"`) via ternary operators to satisfy the stringent Next.js `jsx-a11y` linter. E.g. `aria-pressed={isActive ? "true" : "false"}`.
6. **Accessibility (Nesting):** Avoid wrapping `<input>` elements with `<div>` elements when acting as an interactive dropzone; they must be semantic `<label>` elements to prevent ID collisions and invalid DOM nesting.
7. **Never** use inline `style={{...}}` for layout, padding, or colors
8. **Never** create custom page container divs — use Layout Archetypes

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
