# CSS Conventions

Model Horse Hub uses **Tailwind CSS v4** as its primary styling approach, with design tokens defined via `@theme` in `globals.css`.

See [ADR 002](../architecture/adrs/002-vanilla-css-over-tailwind.md) for the migration rationale.

## Current Stack

- **Tailwind CSS v4** — Utility classes in JSX (`className="flex items-center gap-2"`)
- **`globals.css`** — `@theme` design tokens + shared primitives (`.btn-*`, `.settings-toggle-*`)
- **shadcn/ui** — Form inputs (`<Input>`, `<Select>`, `<Textarea>`), modals (`<Dialog>`), badges (`<Badge>`)
- **Framer Motion** — Micro-interactions (`whileTap`, `whileHover`, `staggerChildren`)

## Rules

### 1. Prefer Tailwind Utility Classes

```tsx
// ✅ Use Warm Parchment themes & tokens
<div className="flex items-center gap-4 rounded-lg border border-edge bg-[#FEFCF8] p-6 shadow-md">
  <h2 className="text-lg font-bold text-ink">Title</h2>
  <p className="text-sm text-ink-light">Description</p>
</div>
```

```tsx
// ❌ Don't use cold default Tailwind gray/stone palettes
<div className="border-stone-200 bg-white text-stone-900">    // BANNED
<div className="text-stone-500 bg-stone-50">  // BANNED
```

```tsx
// ❌ Don't use inline styles for static values
<div style={{ display: "flex", alignItems: "center", gap: 16, padding: 24 }}>
```

### 2. Color Token Reference

The "Cozy Scrapbook" palette uses custom `@theme` variables heavily tuned to warm parchment:

| Usage | Semantic Tailwind Class / Hex | Notes |
|-------|---------------|-------|
| Page background | `bg-[#F4EFE6]` | Warm parchment |
| Card surface | `bg-[#FEFCF8]` | Warm alabaster cards |
| Sticky headers | `bg-[#EAE1CD]/90 backdrop-blur-md` | Semi-transparent blur |
| Primary text | `text-ink` | Deep Espresso (no pure black) |
| Secondary text | `text-ink-light` | Descriptions |
| Muted text | `text-muted` | Hints, metadata |
| Primary accent | `text-forest` / `bg-forest` | Hunter green CTA |
| Borders | `border-edge` | Warm almond borders |
| Success surface | `bg-emerald-50` | Green tint |
| Warning surface | `bg-amber-50` | Amber tint |
| Error surface | `bg-red-50` | Red tint |
| Error text | `text-red-700` | Destructive actions |

### 3. Inline Styles — Only for Dynamic Values

Use `style={{}}` only when the value depends on runtime data:

```tsx
// ✅ Dynamic runtime value — must be inline
<div style={{ borderLeft: `3px solid var(--podium-${ribbon})` }}>

// ✅ Dynamic conditional — must be inline
<button style={{
  background: isActive ? "#ef4444" : "var(--color-surface-elevated)",
}}>

// ❌ Static value — use Tailwind instead
<div style={{ display: "flex", gap: "8px" }}> // → className="flex gap-2"
```

### 4. Shared Primitives Stay in globals.css

If a class is used across multiple components, it belongs in `globals.css`:
- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`
- `.settings-toggle`, `.settings-toggle-active`

> **Note:** `.form-input`, `.form-select`, `.form-textarea` are deprecated. Use shadcn/ui `<Input>`, `<Select>`, `<Textarea>` instead.

### 5. Modals

All modals use **shadcn/ui `<Dialog>`** (Radix-based). Legacy `.modal-*` CSS classes and `createPortal` patterns are deprecated.

> **Exception:** `PhotoLightbox.tsx` retains `createPortal` for custom keyboard navigation.

### 6. Simple Mode Compatibility

Simple Mode (`[data-simple-mode="true"]`) overrides theme tokens for accessibility:
- All backgrounds → white
- All text → black/dark gray
- Buttons → 60px min height
- Fonts → +30% larger

This works automatically via CSS custom properties — no Tailwind changes needed.

### 7. Responsive Design

Use Tailwind's responsive prefixes (mobile-first):

```tsx
// ✅ Tailwind responsive
<div className="flex flex-col md:flex-row lg:grid lg:grid-cols-3">
<div className="p-4 max-sm:p-2">
```

Standard breakpoints:
| Prefix | Min-width |
|--------|-----------|
| `sm` | 640px |
| `md` | 768px |
| `lg` | 1024px |
| `xl` | 1280px |
| `2xl` | 1536px |

### 8. Shadow & Border Convention

Shadows use warm brown tint (defined in theme):

```tsx
// ✅ Use Tailwind shadow classes
<div className="shadow-md">  // warm-tinted shadow via theme

// Or use Tailwind arbitrary values for one-off
<div className="shadow-[0_4px_8px_rgba(80,60,40,0.08)]">
```

## File Architecture

```
src/app/
├── globals.css              # @theme tokens + shared primitives (~2,220 lines)
├── layout.tsx               # Imports globals.css
└── [page]/page.tsx          # Styling via Tailwind className

src/components/
├── ui/                      # 10 shadcn/ui primitives (Button, Input, Dialog, etc.)
├── layouts/                 # 4 Page Archetypes (Explorer, Scrapbook, CommandCenter, Focus)
└── *.tsx                    # Styling via Tailwind className
```

## When to Use What

| Scenario | Approach |
|----------|----------|
| New styling | Tailwind utility classes (`stone` palette) |
| Shared primitives (`.btn`) | `globals.css` |
| Form inputs | shadcn/ui (`<Input>`, `<Select>`, `<Textarea>`) |
| Modals | shadcn/ui `<Dialog>` |
| Truly dynamic values (runtime colors, coordinates) | Inline `style={{}}` |
| React-PDF components | Inline style objects (required by library) |

---

**Next:** [Design System](../components/design-system.md) · [Adding a Feature](adding-a-feature.md)
