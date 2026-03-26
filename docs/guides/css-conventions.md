# CSS Conventions

Model Horse Hub uses **Tailwind CSS v4** as its primary styling approach, with design tokens defined via `@theme` in `globals.css`.

See [ADR 002](../architecture/adrs/002-vanilla-css-over-tailwind.md) for the migration rationale.

## Current Stack

- **Tailwind CSS v4** — Utility classes in JSX (`className="flex items-center gap-2"`)
- **`globals.css`** — `@theme` design tokens + shared primitives (`.btn-*`, `.card`, `.settings-toggle-*`)
- **shadcn/ui** — Form inputs (`<Input>`, `<Select>`, `<Textarea>`), modals (`<Dialog>`), badges (`<Badge>`)
- **Framer Motion** — Micro-interactions (`whileTap`, `whileHover`, `staggerChildren`)

## Rules

### 1. Prefer Tailwind Utility Classes

```tsx
// ✅ Use Tailwind classes
<div className="flex items-center gap-4 rounded-lg border border-edge bg-card p-6 shadow-md">
  <h2 className="text-lg font-bold text-ink">Title</h2>
  <p className="text-sm text-muted">Description</p>
</div>
```

```tsx
// ❌ Don't use inline styles for static values
<div style={{ display: "flex", alignItems: "center", gap: 16, padding: 24 }}>
```

### 2. Use Custom Theme Tokens

Tailwind is configured with project-specific tokens via `@theme` in `globals.css`:

```tsx
// ✅ Use semantic color tokens
<span className="text-forest">Hunter green accent</span>
<span className="text-ink">Primary text</span>
<span className="text-muted">Secondary text</span>
<div className="bg-card border-edge">Card with token colors</div>

// ❌ Don't hard-code hex values except for one-off compositional colors
<span style={{ color: "#2C5545" }}>Don't do this</span>
```

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
- `.card`, `.card-auth`
- `.form-group`, `.form-label`, `.form-hint`, `.form-error`
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
├── ui/                      # 8 shadcn/ui primitives (Button, Input, Dialog, etc.)
├── layouts/                 # 4 Page Archetypes (Explorer, Scrapbook, CommandCenter, Focus)
└── *.tsx                    # Styling via Tailwind className
```

## Design Token Quick Reference

| Category | Tailwind Class | Token |
|----------|---------------|-------|
| **Backgrounds** | `bg-card`, `bg-elevated`, `bg-surface` | Warm parchment palette |
| **Text** | `text-ink`, `text-muted`, `text-ink-light` | Espresso/warm gray hierarchy |
| **Accents** | `text-forest`, `bg-forest` | Hunter green CTA |
| **Borders** | `border-edge` | Warm almond |
| **Success** | `text-success` | Green |
| **Danger** | `text-danger` | Red |

See [Design System](../components/design-system.md) for the complete reference.

## When to Use What

| Scenario | Approach |
|----------|----------|
| New styling | Tailwind utility classes |
| Shared primitives (`.btn`, `.card`) | `globals.css` |
| Form inputs | shadcn/ui (`<Input>`, `<Select>`, `<Textarea>`) |
| Modals | shadcn/ui `<Dialog>` |
| Truly dynamic values (runtime colors, coordinates) | Inline `style={{}}` |
| React-PDF components | Inline style objects (required by library) |

---

**Next:** [Design System](../components/design-system.md) · [Adding a Feature](adding-a-feature.md)
