# Design System

The Model Horse Hub design system is built on **Vanilla CSS** with design tokens (CSS custom properties) in `:root`. The visual identity is **"Warm Equestrian Parchment"** — earthy, warm, and premium-feeling.

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

| Class | Usage |
|-------|-------|
| `.form-group` | Form field wrapper |
| `.form-label` | Field label |
| `.form-input` | Text input |
| `.form-select` | Dropdown select |
| `.form-textarea` | Multi-line input |
| `.form-hint` | Helper text below field |
| `.form-error` | Error message |

### Layout

| Class | Usage |
|-------|-------|
| `.page-container` | Max-width centered content |
| `.auth-page` | Centered auth form layout |

### Modals

| Class | Usage |
|-------|-------|
| `.modal-backdrop` | Full-screen overlay |
| `.modal-content` | Modal container |
| `.modal-header` | Modal title bar |

## CSS Architecture

```
src/app/
├── globals.css          ← Design tokens + shared primitives (~4,670 lines, down from 11.7K)
├── studio.css           ← Art Studio feature styles
├── competition.css      ← Competition feature styles
├── *.module.css         ← 8 page-scoped CSS Modules
└── 12 extracted *.css   ← Page-specific blocks extracted from globals (March 2026)

src/components/
├── 14 *.module.css      ← Component-scoped CSS Modules
└── 16 extracted *.css   ← Component-specific blocks extracted from globals
```

**Total: 49 CSS files** (19 CSS Modules + 30 extracted global stylesheets)

> As of March 2026, 30 large CSS blocks were extracted from `globals.css` into co-located `.css` files. These still use global class names (not CSS Modules) and are imported via `layout.tsx`. See [CSS Conventions](../guides/css-conventions.md) for the full file listing.

---

**Next:** [Component Catalog](catalog.md) · [Component Patterns](patterns.md) · [CSS Conventions](../guides/css-conventions.md)
