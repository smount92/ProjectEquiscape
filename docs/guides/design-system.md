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
