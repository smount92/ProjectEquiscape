# CSS Conventions

Model Horse Hub uses **Tailwind CSS v4** as its primary styling approach, with design tokens defined via `@theme` in `globals.css`.

> **[DESIGN_LANGUAGE.md](DESIGN_LANGUAGE.md) is the authority on how surfaces should look** —
> materials, tokens, the leather/ledger doctrine, Lamplight, the five-room nav. This page covers
> the mechanical conventions only. Where the two disagree, DESIGN_LANGUAGE wins.

See [ADR 002](../architecture/adrs/002-vanilla-css-over-tailwind.md) for the migration rationale.

## Current Stack

- **Tailwind CSS v4** — Utility classes in JSX (`className="flex items-center gap-2"`)
- **`globals.css`** — `@theme` design tokens + shared primitives (`.btn-*`, `.settings-toggle-*`)
- **shadcn/ui** — Form inputs (`<Input>`, `<Select>`, `<Textarea>`), modals (`<Dialog>`), badges (`<Badge>`)
- **Framer Motion** — Micro-interactions (`whileTap`, `whileHover`, `staggerChildren`)

## Rules

### 1. Tokens only — never raw hex, never the cold palette

```tsx
// ✅ Semantic tokens. These are the only colours that flip correctly.
<div className="flex items-center gap-4 rounded-lg border border-input bg-card p-6 shadow-md">
  <h2 className="text-lg font-bold text-foreground">Title</h2>
  <p className="text-sm text-muted-foreground">Description</p>
</div>
```

```tsx
// ❌ Cold default Tailwind palettes — BANNED
<div className="border-stone-200 bg-white text-stone-900">
<div className="text-stone-500 bg-stone-50">

// ❌ Arbitrary hex — BANNED, and worse than it looks
<div className="bg-[#FEFCF8] text-[#ef4444]">
```

Arbitrary hex is **invisible to the Lamplight override selectors**, so a hardcoded colour simply
does not flip at night. That is why the ban is absolute rather than stylistic.

```tsx
// ❌ Don't use inline styles for static values
<div style={{ display: "flex", alignItems: "center", gap: 16, padding: 24 }}>
```

### 2. Color Token Reference

Semantic tokens (the shadcn base) plus the brand extensions, all defined in `globals.css`:

| Usage | Class | Notes |
|-------|-------|-------|
| Page background | `bg-background` | |
| Card surface | `bg-card` | Flips under Lamplight |
| Primary text | `text-foreground` | Never pure black |
| Muted text | `text-muted-foreground` | Hints, metadata, timestamps |
| Primary accent | `text-primary` / `bg-primary` / `text-forest` | `#2C5545` forest |
| Borders | `border-input` / `border-border` | |
| Success / warning / info | `bg-success/10`, `bg-warning/10`, `bg-info/10` | Brand extensions |
| Destructive | `text-destructive` / `bg-destructive` | |
| Text on leather or wood | `--leather-text*` or `.text-engraved-light` | **Required** — default ink is dark and vanishes on leather in day mode |
| Surfaces that must not darken | `--paper-lit`, `--paper-lit-ink` | Polaroids, post frames, brass plaques: a photograph is white in a dark room |

For the material classes (`.leather-band`, `.ledger-card`, `.brass-heading`, `.paddock-post`,
`.thread-post`, …) see [DESIGN_LANGUAGE.md §3](DESIGN_LANGUAGE.md).

### 3. Inline Styles — Only for Dynamic Values

Use `style={{}}` only when the value depends on runtime data:

```tsx
// ✅ Dynamic runtime value — must be inline, and still uses a token
<div style={{ borderLeft: `3px solid var(--podium-${ribbon})` }}>

// ✅ Dynamic conditional — inline, both branches tokenised
<button style={{
  background: isActive ? "var(--destructive)" : "var(--color-surface-elevated)",
}}>

// ❌ Static value — use Tailwind instead
<div style={{ display: "flex", gap: "8px" }}> // → className="flex gap-2"
```

Being inline does not exempt a value from the token rule — `"#ef4444"` in a `style` object is
just as invisible to the night-mode override as `text-[#ef4444]` is.

### 4. Shared Primitives Stay in globals.css

If a class is used across multiple components, it belongs in `globals.css`:
- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`
- `.settings-toggle`, `.settings-toggle-active`

> **Note:** `.form-input`, `.form-select`, `.form-textarea` are deprecated. Use shadcn/ui `<Input>`, `<Select>`, `<Textarea>` instead.

### 5. Modals

All modals use **shadcn/ui `<Dialog>`** (Radix-based). Legacy `.modal-*` CSS classes and `createPortal` patterns are deprecated.

> **Exception:** `PhotoLightbox.tsx` retains `createPortal` for custom keyboard navigation.

### 6. Simple Mode and Lamplight must both work

Simple Mode (`[data-simple-mode="true"]`) bumps the font scale ~1.3×, enlarges touch targets, and
**strips every texture to flat high-contrast tokens**. Lamplight (`html[data-theme="night"]`)
redefines the semantic tokens for the dark theme.

Both work automatically for any surface built from tokens — which is the whole reason for the
token rule. Two obligations when you add a new class:

1. If it paints a background or a colour, give it a matching `html[data-theme="night"]` rule (and
   a Simple Mode rule if it carries texture). Order them Simple Mode first, then Lamplight, the
   way `.ledger-card`, `.paddock-post` and `.thread-post` are patched in `globals.css`.
2. **Never encode meaning in texture alone** — Simple Mode removes it.

Prefer painting nothing: a class that only sets padding inherits whichever paper the theme chose
and can never be wrong in either mode.

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
├── globals.css              # @theme tokens + material classes + night/Simple Mode
│                            #   overrides (~3,980 lines — the only stylesheet)
├── layout.tsx               # Imports globals.css; stamps the theme pre-paint
└── [page]/page.tsx          # Styling via Tailwind className

src/components/
├── ui/                      # shadcn/ui primitives (Button, Input, Dialog, etc.)
├── layouts/                 # 4 Page Archetypes (Explorer, Scrapbook, CommandCenter, Focus)
└── *.tsx                    # Styling via Tailwind className
```

## When to Use What

| Scenario | Approach |
|----------|----------|
| New styling | Tailwind utilities with **semantic tokens** — never `stone`/`white`/raw hex |
| A landmark surface (masthead, showcase, results) | Material classes — see [DESIGN_LANGUAGE.md](DESIGN_LANGUAGE.md) |
| A working surface (form, table, dashboard) | `.ledger-card` + `.brass-heading` |
| A post or comment | `.ledger-card` + `.paddock-post` / `.thread-post` |
| Shared primitives (`.btn`) | `globals.css` |
| Form inputs | shadcn/ui (`<Input>`, `<Select>`, `<Textarea>`) |
| Modals | shadcn/ui `<Dialog>` (exception: `PhotoLightbox.tsx`) |
| Truly dynamic values (runtime colors, coordinates) | Inline `style={{}}`, still using `var(--token)` |
| React-PDF components | Inline style objects (required by library) |

---

**Next:** [Design Language](DESIGN_LANGUAGE.md) · [Adding a Feature](adding-a-feature.md)
