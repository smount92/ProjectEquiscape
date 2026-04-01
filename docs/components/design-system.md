# Design System

The Model Horse Hub design system is built on **Tailwind CSS v4** with design tokens defined via the `@theme` directive in `globals.css`. The visual identity is **"Cozy Scrapbook"** — warm serif headings, tactile cards, and earthy tones. See [Design System Guide](../guides/design-system.md) for the full specification.

## Color Palette

> **Warm Parchment Palette (2026-03-28):** The design system uses custom `@theme` tokens (`text-ink`, `text-muted`, `border-edge`, `bg-forest`) mapped to warm parchment hex values in `globals.css`. The cold default Tailwind `stone` palette (`bg-stone-50`, `text-stone-900`, etc.) is banned. See `docs/guides/design-system.md` for the canonical spec.

### Standard Mode (Warm Parchment Palette)

> See `docs/guides/design-system.md` for the canonical color reference and banned token list.

| Tailwind Class | Hex | Usage |
|----------------|-----|-------|
| `bg-[#F4EFE6]` | `#F4EFE6` | Page backgrounds (warm parchment) |
| `bg-[#FEFCF8]` | `#FEFCF8` | Card surfaces, input backgrounds |
| `bg-[#EAE1CD]` | `#EAE1CD` | Sticky headers, section dividers, footer |
| `text-ink` | `#2D2318` | Primary text (Warm Espresso) |
| `text-ink-light` | `#594A3C` | Secondary/supporting text |
| `text-muted` | `#7A6A58` | Muted text, hints, metadata |
| `text-forest` / `bg-forest` | `#2C5545` | Primary accent (Hunter Green) |
| `border-edge` | `#E0D5C1` | All structural borders |
| `bg-emerald-50` | — | Success state surfaces |
| `bg-amber-50` | — | Warning state surfaces |
| `bg-red-50` | — | Error state surfaces |
| `text-red-700` | — | Destructive action text |
| `bg-purple-50` | — | Art Studio accent surfaces |

**❌ Banned:** `bg-white`, `bg-stone-50`, `bg-stone-100`, `border-stone-200`, `text-stone-900`, `text-stone-600`, `text-stone-500`, `text-stone-400`

### Simple Mode (Accessibility)

Activated via `[data-simple-mode="true"]` on `<body>`:
- **All backgrounds → pure white** (maximum contrast)
- **All text → black/dark gray** (#111, #333, #555)
- **Borders → 2px solid black**
- **Fonts → +30% larger** (`--font-scale: 1.3`)
- **Buttons → 60px min height**, full width, bold text

## Typography

| Element | Font | Classes |
|---------|------|---------|
| Page titles, H1-H2 | Playfair Display | `font-serif text-3xl md:text-4xl font-bold tracking-tight` |
| Section headers, H3 | Playfair Display | `font-serif text-xl font-semibold` |
| Body text | Inter | `font-sans text-base` |
| Captions, metadata | Inter | `text-sm text-ink-light` |
| Hints, badges | Inter | `text-xs text-muted` |

**All font sizes** use `calc(var(--font-size-*) * var(--font-scale))` to support Simple Mode.

## Spacing

Strict 8-point grid:

| Tailwind | Value | Usage |
|----------|-------|-------|
| `p-2`, `gap-2` | 8px | Tight spacing, badge padding |
| `p-4`, `gap-4` | 16px | Standard card padding |
| `p-6`, `gap-6` | 24px | Card sections, grid gaps |
| `p-8`, `gap-8` | 32px | Section spacing |

## Shadows

All shadows are **warm brown-tinted** (`rgba(80, 60, 40, ...)`) — not standard gray.

| Class | Usage |
|-------|-------|
| `shadow-sm` | Subtle elevation |
| `shadow-md` | Cards, dropdowns |
| `shadow-lg` | Modals, popovers |

## Shared Primitives (global classes)

### Buttons

| Class | Usage |
|-------|-------|
| `.btn` | Base button (all buttons extend this) |
| `.btn-primary` | Hunter Green CTA |
| `.btn-secondary` | Outlined button |
| `.btn-danger` | Red destructive action |
| `.btn-small` | Compact button |
| `.btn-link` | Text-only button |

### Forms

Form elements use **shadcn/ui** components (Radix-based). Legacy `.form-*` classes are deprecated.

| Component | Import | Replaces |
|-----------|--------|---------|
| `<Input>` | `@/components/ui/input` | `.form-input` |
| `<Textarea>` | `@/components/ui/textarea` | `.form-textarea` |
| `<Select>` | `@/components/ui/select` | `.form-select` |

### Modals

Modals use **shadcn/ui `<Dialog>`** (Radix-based). Legacy `.modal-*` classes are deprecated.

```tsx
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";

<Dialog open={isOpen} onOpenChange={setIsOpen}>
  <DialogContent>
    <DialogHeader><DialogTitle>Title</DialogTitle></DialogHeader>
    {/* Content */}
  </DialogContent>
</Dialog>
```

> **Exception:** `PhotoLightbox.tsx` retains `createPortal` for custom keyboard navigation.

## CSS Architecture

```
src/app/
├── globals.css          ← @theme design tokens + shared primitives (~1,750 lines)
├── [page]/page.tsx      ← Styling via Tailwind utility classes in className
└── layout.tsx           ← Imports globals.css

src/components/
├── ui/                  ← 10 shadcn/ui primitives (Button, Input, Select, etc.)
├── layouts/             ← 4 Page Archetypes (Explorer, Scrapbook, CommandCenter, Focus)
└── *.tsx                ← Styling via Tailwind utility classes in className
```

> **Migration status (March 2026):** CSS Modules and legacy `.css` files have been fully eliminated. All styling is now Tailwind utility classes + `globals.css` shared primitives. The color palette uses custom `@theme` warm parchment tokens (`text-ink`, `text-muted`, `border-edge`, etc.) — the cold Tailwind `stone` palette is banned. Form inputs use shadcn/ui. Modals use shadcn Dialog. See the [Design System Guide](../guides/design-system.md) for the 4 page archetypes and the banned token list.

---

**Next:** [Component Catalog](catalog.md) · [Component Patterns](patterns.md) · [CSS Conventions](../guides/css-conventions.md)
