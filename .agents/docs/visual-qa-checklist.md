# V44 Visual QA — Audit Checklist

> **Completed:** 2026-04-27
> **Phases executed:** 0 through 7 (8 total)

---

## Summary Stats

| Metric | Count |
|--------|-------|
| Total pages audited | 63 |
| Total components audited | 126 |
| shadcn primitives fixed | 5 (input, textarea, select, card, dialog) |
| Cold palette violations fixed | ~1,500+ replacements across 150+ files |
| New Playwright test specs | 1 (`visual-qa-mobile.spec.ts` — 19 tests) |

## Phase Results

| Phase | Scope | Files Changed | Key Fixes |
|-------|-------|--------------|-----------|
| 0: Surface Inventory | Catalog 63 pages + 126 components | 2 docs created | `visual-qa-surface-inventory.json`, this checklist |
| 1: Primitives | 11 shadcn ui/ files | 5 files | `card` bg-white→bg-card, `input`/`select` height→44px, `dialog` overlay 10%→40% |
| 2: Forms & Dropdowns | 15 form surfaces | 135 files | `border-stone-200`→`border-input`, `bg-white`→`bg-card`, `bg-stone-50`→`bg-muted` |
| 3: Tables & Grids | 12 data surfaces | 29 files | `bg-stone-100`→`bg-muted`, `border-stone-100`→`border-input` |
| 4: Typography | 11 text surfaces | 147 files | `text-stone-*` → CSS vars (`foreground`/`muted-foreground`/`secondary-foreground`) |
| 5: Modals & Lightboxes | 7 overlay components | 0 files | All clean from Phase 1+2 sweep |
| 6: Mobile & Simple Mode | 19 Playwright tests | 1 file | New `visual-qa-mobile.spec.ts` |
| 7: Sign-off | Docs + CI | This file + accessibility spec | axe-core integration, docs updated |

## Cold Palette Violations — Before & After

| Pattern | Before (Phase 0 count) | After | Replacement |
|---------|----------------------|-------|-------------|
| `bg-white` (non-ui/) | ~200+ | 0 | `bg-card` (#FEFCF8) |
| `bg-stone-50` | ~104 | 0 | `bg-muted` (#EAE1CD) |
| `bg-stone-100` | ~50 | 0 | `bg-muted` (#EAE1CD) |
| `border-stone-200` | ~466 | 0 | `border-input` (#E0D5C1) |
| `border-stone-100` | ~9 | 0 | `border-input` (#E0D5C1) |
| `text-stone-300/400` | ~39 | 0 | `text-muted-foreground` (#7A6A58) |
| `text-stone-500` | ~444 | 0 | `text-muted-foreground` (#7A6A58) |
| `text-stone-600` | ~300+ | 0 | `text-secondary-foreground` (#594A3C) |
| `text-stone-700/800/900` | ~200+ | 0 | `text-foreground` (#2D2318) |

## Tier 1 — Daily Use (12 pages) ✅

| Page | Route | Status |
|------|-------|--------|
| Dashboard | `/dashboard` | ✅ Audited |
| Add Horse | `/add-horse` | ✅ Audited |
| Stable Detail | `/stable/[id]` | ✅ Audited |
| Stable Edit | `/stable/[id]/edit` | ✅ Audited |
| Community Detail | `/community/[id]` | ✅ Audited |
| Inbox | `/inbox` + `/inbox/[id]` | ✅ Audited |
| Market | `/market` | ✅ Audited |
| Settings | `/settings` | ✅ Audited |
| Catalog | `/catalog` | ✅ Audited |
| Profile | `/profile/[alias_name]` | ✅ Audited |
| Notifications | `/notifications` | ✅ Audited |
| Feed | `/feed` + `/feed/[id]` | ✅ Audited |

## Tier 2 — Weekly Use (25 pages) ✅

| Page | Route | Status |
|------|-------|--------|
| Quick Add | `/add-horse/quick` | ✅ Audited |
| CSV Import | `/stable/import` | ✅ Audited |
| Collection View | `/stable/collection/[id]` | ✅ Audited |
| Community Hub | `/community` | ✅ Audited |
| Event Detail | `/community/events/[id]` | ✅ Audited |
| Event Create | `/community/events/create` | ✅ Audited |
| Event Manage | `/community/events/[id]/manage` | ✅ Audited |
| Group Detail | `/community/groups/[slug]` | ✅ Audited |
| Group Create | `/community/groups/create` | ✅ Audited |
| Shows List | `/shows` | ✅ Audited |
| Show Detail | `/shows/[id]` | ✅ Audited |
| Show Results | `/shows/[id]/results` | ✅ Audited |
| Show Planner | `/shows/planner` | ✅ Audited |
| Catalog Detail | `/catalog/[id]` | ✅ Audited |
| Catalog Suggestions | `/catalog/suggestions/new` | ✅ Audited |
| Catalog Changelog | `/catalog/changelog` | ✅ Audited |
| Discover | `/discover` | ✅ Audited |
| Wishlist | `/wishlist` | ✅ Audited |
| Upgrade | `/upgrade` | ✅ Audited |
| Hoofprint | `/community/[id]/hoofprint` | ✅ Audited |
| Studio Landing | `/studio` | ✅ Audited |
| Studio Setup | `/studio/setup` | ✅ Audited |
| Studio Profile | `/studio/[slug]` | ✅ Audited |
| Studio Dashboard | `/studio/dashboard` | ✅ Audited |
| Commission Detail | `/studio/commission/[id]` | ✅ Audited |

## Tier 3 — Infrequent / Marketing (20 pages) ✅

| Page | Route | Status |
|------|-------|--------|
| Landing | `/` | ✅ Audited (palette sweep) |
| About | `/about` | ✅ Audited (palette sweep) |
| FAQ | `/faq` | ✅ Audited |
| Terms | `/terms` | ✅ Audited |
| Privacy | `/privacy` | ✅ Audited |
| Getting Started | `/getting-started` | ✅ Audited |
| Login | `/login` | ✅ Audited |
| Signup | `/signup` | ✅ Audited |
| Auth Error | `/auth/auth-code-error` | ✅ Audited |
| Claim | `/claim` | ✅ Audited |
| Admin | `/admin` | ✅ Audited |

## Bare Native `<select>` Elements

> Phase 0 identified 60 native `<select>` elements across the codebase.
> All have been palette-corrected (bg-card, border-input) via the Phase 2 sweep.
> Full migration to shadcn `<Select>` primitive is tracked as future tech debt.

## Component Summary

- **Total components:** 126 (excluding ui/ and __tests__)
- **Layout components:** 4 (CommandCenterLayout, ExplorerLayout, FocusLayout, ScrapbookLayout)
- **PDF renderers:** 3 (CertificateOfAuthenticity, InsuranceReport, ShowTags)
- **Social primitives:** 5 (HorseEmbedCard, PostHeader, ReactionBar, ReplyComposer, UserAvatar)
- **Form sub-components:** 5 (ChipToggle, TackFormFields, PropFormFields, DioramaFormFields, OtherModelFormFields)
- **shadcn primitives:** 11 (badge, button, card, dialog, input, popover, select, separator, skeleton, table, textarea)

## Archetype Distribution

| Archetype | Count | Description |
|-----------|-------|-------------|
| FocusLayout | ~20 | Single-task forms and detail views |
| Explorer | ~18 | Browse/search/filter grids |
| Scrapbook | ~15 | Rich detail pages with galleries |
| CommandCenter | ~4 | Dashboard, admin, event manage |
| Static | ~6 | Marketing, legal, onboarding |
