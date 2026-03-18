# ADR 002: Vanilla CSS Over Tailwind

**Status:** Accepted  
**Date:** January 2026  
**Deciders:** Project team

## Context

The project needed a CSS strategy. The main options considered were:
1. **Tailwind CSS** — Utility-first framework
2. **Vanilla CSS** — Hand-written CSS with design tokens
3. **CSS-in-JS** — styled-components, Emotion, etc.

## Decision

Use **Vanilla CSS** with a design token system in `:root` and **CSS Modules** for component scoping.

## Rationale

- **Full control:** No abstraction layer between intent and output
- **Design token system:** Custom properties in `:root` provide consistent theming (the "Warm Equestrian Parchment" palette)
- **CSS Modules for scoping:** Component-level styles without global pollution
- **No build dependency:** No Tailwind PostCSS plugin, no purge configuration
- **Accessible theming:** Simple Mode (`[data-simple-mode="true"]`) with 130% fonts and 60px min-target buttons is straightforward with custom properties

## Consequences

- `globals.css` is ~11K lines (design tokens + shared primitives)
- New developers must learn the token system rather than Tailwind utilities
- CSS extraction from globals to modules is an ongoing effort (19 modules created so far)
- No automatic class name conflicts — requires discipline

## Current Architecture

| File | Purpose |
|------|---------|
| `globals.css` | Design tokens (`:root`), shared primitives (`.btn-*`, `.card`, `.form-*`, `.modal-*`) |
| `studio.css` | Art Studio feature styles |
| `competition.css` | Competition feature styles |
| `*.module.css` | 19 component-scoped CSS Modules |

**Convention:** New components must use CSS Modules. Shared primitives stay in `globals.css`.
