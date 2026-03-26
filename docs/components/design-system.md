# Design System

The Model Horse Hub design system is built on **Tailwind CSS v4** with design tokens defined via the `@theme` directive in `globals.css`. The visual identity is **"Cozy Scrapbook"** — warm serif headings, tactile cards, and earthy tones. See [Design System Guide](../guides/design-system.md) for the full specification.

## Color Palette

### Standard Mode

| Token | Value | Usage |
|-------|-------|-------|
| `--color-bg-primary` | `#F0EAD6` | Page background (warm parchment) |
| `--color-bg-secondary` | `#E8DFC9` | Header, sidebar backgrounds |
| `--color-bg-card` | `#FBF7ED` | Card backgrounds |
| `--color-bg-card-hover` | `#F5EFE0` | Card hover state |
| `--color-bg-input` | `#F8F3E8` | Form input backgrounds |
| `--color-text-primary` | `#2D2318` | Main text (Rich Espresso) |
| `--color-text-secondary` | `#59493A` | Supporting text (Warm Slate) |
| `--color-text-muted` | `#8B7B6A` | Hints, placeholders |
| `--color-accent-primary` | `#2C5545` | CTA buttons, links (Hunter Green) |
| `--color-accent-secondary` | `#8B5A2B` | Secondary accents (Saddle Brown) |
| `--color-accent-success` | `#356845` | Success states |
| `--color-accent-danger` | `#9B3028` | Error, delete states |
| `--color-accent-warning` | `#B8860B` | Warnings |
| `--color-border` | `#D4C9B5` | Card borders (Warm Almond) |

### Simple Mode (Accessibility)

Activated via `[data-simple-mode="true"]` on `<body>`:
- **All backgrounds → pure white** (maximum contrast)
- **All text → black/dark gray** (#111, #333, #555)
- **Borders → 2px solid black**
- **Fonts → +30% larger** (`--font-scale: 1.3`)
- **Buttons → 60px min height**, full width, bold text

## Typography

| Token | Value | Usage |
|-------|-------|-------|
| `--font-family` | `'Inter', system-ui, sans-serif` | Body text |
| `--font-family-serif` | `Georgia, 'Times New Roman', serif` | Headings (h1-h6) |
| `--font-size-xs` | `0.75rem` (12px) | Hints, badges |
| `--font-size-sm` | `0.875rem` (14px) | Captions, metadata |
| `--font-size-base` | `1rem` (16px) | Body text (PRD minimum) |
| `--font-size-md` | `1.125rem` (18px) | Emphasized text |
| `--font-size-lg` | `1.25rem` (20px) | Section titles |
| `--font-size-xl` | `1.5rem` (24px) | H3 |
| `--font-size-2xl` | `2rem` (32px) | H2 |
| `--font-size-3xl` | `2.5rem` (40px) | H1 |

**All font sizes** use `calc(var(--font-size-*) * var(--font-scale))` to support Simple Mode.

## Spacing

| Token | Value |
|-------|-------|
| `--space-xs` | `0.25rem` (4px) |
| `--space-sm` | `0.5rem` (8px) |
| `--space-md` | `1rem` (16px) |
| `--space-lg` | `1.5rem` (24px) |
| `--space-xl` | `2rem` (32px) |
| `--space-2xl` | `3rem` (48px) |
| `--space-3xl` | `4rem` (64px) |

## Border Radius

| Token | Value |
|-------|-------|
| `--radius-sm` | `6px` |
| `--radius-md` | `10px` |
| `--radius-lg` | `16px` |
| `--radius-xl` | `24px` |
| `--radius-full` | `9999px` (pill) |

## Shadows

| Token | Usage |
|-------|-------|
| `--shadow-sm` | Subtle elevation |
| `--shadow-md` | Cards, dropdowns |
| `--shadow-lg` | Modals, popovers |
| `--shadow-glow` | CTA buttons, focused elements (green-tinted) |

All shadows are **warm brown-tinted** (`rgba(80, 60, 40, ...)`) — not standard gray.

## Transitions

| Token | Duration |
|-------|----------|
| `--transition-fast` | `150ms ease` |
| `--transition-base` | `250ms ease` |
| `--transition-slow` | `400ms ease` |

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

### Cards

| Class | Usage |
|-------|-------|
| `.card` | Standard card container |
| `.card-auth` | Auth page card (centered, green top border) |
| `.card-header` | Card title section |

### Forms

Form elements use **shadcn/ui** components (Radix-based). Legacy `.form-*` classes are deprecated.

| Component | Import | Replaces |
|-----------|--------|---------|
| `<Input>` | `@/components/ui/input` | `.form-input` |
| `<Textarea>` | `@/components/ui/textarea` | `.form-textarea` |
| `<Select>` | `@/components/ui/select` | `.form-select` |

Global class `.form-group`, `.form-label`, `.form-hint`, `.form-error` remain for layout/labeling.

### Layout

| Class | Usage |
|-------|-------|
| `.page-container` | Max-width centered content |
| `.auth-page` | Centered auth form layout |

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
├── globals.css          ← @theme design tokens + shared primitives (~2,220 lines)
├── [page]/page.tsx      ← Styling via Tailwind utility classes in className
└── layout.tsx           ← Imports globals.css

src/components/
├── ui/                  ← 8 shadcn/ui primitives (Button, Input, Select, etc.)
├── layouts/             ← 4 Page Archetypes (Explorer, Scrapbook, CommandCenter, Focus)
└── *.tsx                ← Styling via Tailwind utility classes in className
```

> **Migration status (March 2026):** CSS Modules and legacy `.css` files have been fully eliminated. All styling is now Tailwind utility classes + `globals.css` shared primitives. Form inputs use shadcn/ui. Modals use shadcn Dialog. See the [Design System Guide](../guides/design-system.md) for the 4 page archetypes and the full design specification.

---

**Next:** [Component Catalog](catalog.md) · [Component Patterns](patterns.md) · [CSS Conventions](../guides/css-conventions.md)
