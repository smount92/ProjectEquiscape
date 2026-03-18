# CSS Conventions

Model Horse Hub uses **Vanilla CSS** with design tokens and CSS Modules. No Tailwind.

See [ADR 002](../architecture/adrs/002-vanilla-css-over-tailwind.md) for the rationale.

## File Architecture

```
src/app/
├── globals.css                       # Design tokens (:root) + shared primitives
├── studio.css                        # Art Studio feature styles
├── competition.css                   # Competition feature styles
├── page.module.css                   # Landing page styles
├── dashboard/dashboard.module.css    # Dashboard styles
├── discover/discover.module.css      # Discover page styles
├── inbox/inbox.module.css            # Inbox styles
└── settings/settings.module.css      # Settings styles

src/components/
├── ChatThread.module.css
├── DashboardShell.module.css
├── DashboardToast.module.css
├── FavoriteButton.module.css
├── FeaturedHorseCard.module.css
├── GroupAdminPanel.module.css
├── GroupDetailClient.module.css
├── GroupFiles.module.css
├── MakeOfferModal.module.css
├── MatchmakerMatches.module.css
├── OfferCard.module.css
├── RatingForm.module.css
├── StableLedger.module.css
└── WishlistButton.module.css
```

**Total:** 19 CSS Modules

## Rules

### 1. New Components Must Use CSS Modules

```css
/* ✅ MyComponent.module.css */
.container {
    padding: var(--space-lg);
    background: var(--color-bg-card);
}
```

```tsx
// ✅ MyComponent.tsx
import styles from "./MyComponent.module.css";

export default function MyComponent() {
    return <div className={styles.container}>...</div>;
}
```

### 2. Use Design Tokens — Never Hard-Code

```css
/* ❌ WRONG */
.title {
    color: #333;
    padding: 16px;
    background: white;
}

/* ✅ RIGHT */
.title {
    color: var(--color-text-primary);
    padding: var(--space-md);
    background: var(--color-bg-card);
}
```

### 3. Shared Primitives Stay in globals.css

If a class is used across multiple components, it belongs in `globals.css`:
- `.btn`, `.btn-primary`, `.btn-secondary`, `.btn-danger`
- `.card`, `.card-auth`
- `.form-group`, `.form-input`, `.form-select`, `.form-textarea`
- `.modal-backdrop`, `.modal-content`
- `.page-container`

### 4. Combining Module + Global Classes

```tsx
<button className={`btn btn-primary ${styles.myCustomButton}`}>
    Submit
</button>

<div className={`card ${styles.featureCard}`}>
    Content
</div>
```

### 5. Simple Mode Compatibility

All font sizes must use the `--font-scale` multiplier:

```css
/* ✅ Scales with Simple Mode */
.text {
    font-size: calc(var(--font-size-base) * var(--font-scale));
}

/* ❌ Won't scale in Simple Mode */
.text {
    font-size: 16px;
}
```

All buttons must respect `--btn-min-h`:

```css
.myButton {
    min-height: var(--btn-min-h); /* 44px normal, 60px Simple Mode */
}
```

### 6. Responsive Breakpoints

Use these consistent breakpoints:

```css
/* Mobile-first, then scale up */
@media (min-width: 768px) {
    /* Tablet */
}

@media (min-width: 1024px) {
    /* Desktop */
}

@media (min-width: 1440px) {
    /* Widescreen */
}
```

### 7. Shadow & Border Tinting

Shadows use warm brown tint (not gray):

```css
/* ✅ Project convention */
box-shadow: 0 4px 8px rgba(80, 60, 40, 0.08);

/* ❌ Generic gray */
box-shadow: 0 4px 8px rgba(0, 0, 0, 0.1);
```

Or use the token: `box-shadow: var(--shadow-md);`

## Design Token Quick Reference

| Category | Key Tokens |
|----------|-----------|
| **Backgrounds** | `--color-bg-primary` (parchment), `--color-bg-card` (warm white) |
| **Text** | `--color-text-primary` (espresso), `--color-text-secondary` (warm gray) |
| **Accents** | `--color-accent-primary` (hunter green), `--color-accent-secondary` (saddle brown) |
| **Spacing** | `--space-xs` (4px) through `--space-3xl` (64px) |
| **Radii** | `--radius-sm` (6px) through `--radius-full` (pill) |
| **Shadows** | `--shadow-sm/md/lg` (warm-tinted), `--shadow-glow` (green) |
| **Transitions** | `--transition-fast` (150ms), `--transition-base` (250ms) |

See [Design System](../components/design-system.md) for the complete reference.

## When to Add to globals.css vs Module

| Scenario | Where |
|----------|-------|
| Used by 3+ components | `globals.css` |
| Component-specific styling | `ComponentName.module.css` |
| Feature-wide styling (Studio, Competition) | `studio.css` / `competition.css` |
| Design token or utility class | `globals.css` `:root` |

---

**Next:** [Design System](../components/design-system.md) · [Adding a Feature](adding-a-feature.md)
