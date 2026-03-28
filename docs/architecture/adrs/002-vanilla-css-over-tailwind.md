# ADR 002: CSS Strategy — Tailwind CSS v4

**Status:** Superseded (originally Vanilla CSS → migrated to Tailwind CSS v4, March 2026)  
**Date:** January 2026 (created), March 2026 (updated)  
**Deciders:** Project team

## Context

The project originally chose Vanilla CSS with design tokens and CSS Modules (see "Original Decision" below). After scaling to 50+ pages, 100+ components, and ~11K lines of `globals.css`, the team migrated to **Tailwind CSS v4** for better maintainability, consistency, and developer velocity.

## Current Decision

Use **Tailwind CSS v4** as the primary styling approach:
- Utility classes directly in JSX (`className="flex items-center gap-2 rounded-lg"`)
- Design tokens defined via `@theme` in `globals.css`
- Shared primitives (`.btn`, `.form-input`, `.card`, etc.) remain in `globals.css` as `@apply` or plain CSS
- Legacy CSS Modules and extracted `.css` files still exist but are not the pattern for new work

## Rationale for Migration

- **globals.css bloat:** 11K+ lines became hard to maintain; extracted CSS files multiplied to 49 files
- **Inline style proliferation:** Without Tailwind, developers frequently used `style={{}}` for one-off styling, creating an inconsistent mix of CSS Modules + inline styles + global classes
- **Consistent utility API:** Tailwind provides a single vocabulary for spacing, colors, typography, and responsive design
- **v4 advantages:** CSS-native `@theme` tokens, no PostCSS config, automatic content detection

## Consequences

- Legacy CSS Modules and extracted `.css` files have been fully eliminated
- All components use Tailwind utility classes exclusively
- `globals.css` (~2,200 lines) retains design tokens in `@theme`, shared primitives (`.btn-*`, `.settings-toggle-*`), and a small number of component-specific styles
- Inline `style={{}}` is only acceptable for truly dynamic values (runtime-computed colors, crop coordinates, etc.)
- Legacy semantic tokens (`bg-card`, `border-edge`, `text-ink`, `text-muted`, etc.) have been fully replaced with standard `stone` palette equivalents

## Migration Status: ✅ COMPLETE (2026-03-28)

- **Tailwind v4 installed and configured** — `@theme` block in `globals.css` maps design tokens
- **Token migration complete** — All 143+ legacy RGBA patterns, semantic tokens, and inline styles converted
- **100% of pages and components** use standard Tailwind stone palette
- **4 layout archetypes** deployed (Explorer, Scrapbook, CommandCenter, Focus)
- **shadcn/ui** for all form inputs, modals, badges
- **Framer Motion** for micro-interactions

## Original Decision (January 2026)

> Use Vanilla CSS with design tokens in `:root` and CSS Modules for component scoping.
>
> Rationale: Full control, no abstraction layer, no build dependency, straightforward accessible theming via Simple Mode custom properties.
>
> This approach was superseded when the codebase grew beyond what hand-written CSS could maintain consistently.

## Convention (Current)

| Scenario | Approach |
|----------|----------|
| New styling | Tailwind utility classes (`stone` palette) |
| Shared primitives (`.btn`) | Keep in `globals.css` |
| Truly dynamic values (runtime colors, coordinates) | Inline `style={{}}` |
| Legacy CSS Modules | Fully eliminated — no longer present |

