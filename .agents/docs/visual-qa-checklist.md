# V44 Visual QA Checklist

> Living document. Updated as each phase completes.
> Generated: 2026-04-26

## Tier 1 — Daily Use (audit FIRST)

| Page | Route | Archetype | Lines | Phase Target |
|------|-------|-----------|-------|-------------|
| Dashboard | `/dashboard` | CommandCenter | 501 | P2, P3 |
| Add to Stable | `/add-horse` | FocusLayout | 1570 | P2 |
| Stable Detail | `/stable/[id]` | Scrapbook | 612 | P4 |
| Stable Edit | `/stable/[id]/edit` | FocusLayout | 1504 | P2 |
| Community Detail | `/community/[id]` | Scrapbook | 707 | P4 |
| Inbox / Chat | `/inbox/[id]` | FocusLayout | 362 | P2, P5 |
| Inbox List | `/inbox` | Explorer | 268 | P3 |
| Market | `/market` | Explorer | 209 | P2, P3 |
| Settings | `/settings` | FocusLayout | 549 | P2 |
| Catalog | `/catalog` | Explorer | 153 | P3 |
| Profile | `/profile/[alias_name]` | Scrapbook | 538 | P4 |
| Notifications | `/notifications` | Explorer | 31 | P4 |
| Feed | `/feed` | Explorer | 76 | P4 |

## Tier 2 — Weekly Use (audit SECOND)

| Page | Route | Archetype | Lines | Phase Target |
|------|-------|-----------|-------|-------------|
| Shows List | `/shows` | Explorer | 127 | P3 |
| Show Detail | `/shows/[id]` | Scrapbook | 343 | P3, P4 |
| Show Results | `/shows/[id]/results` | Explorer | 186 | P3 |
| Show Planner | `/shows/planner` | FocusLayout | 43 | P2 |
| Show Ring | `/community` | Explorer | 260 | P3 |
| Event Detail | `/community/events/[id]` | Scrapbook | 414 | P4 |
| Event Manage | `/community/events/[id]/manage` | CommandCenter | 1075 | P2, P3 |
| Event Create | `/community/events/create` | FocusLayout | 249 | P2 |
| Events List | `/community/events` | Explorer | 35 | P3 |
| Groups List | `/community/groups` | Explorer | 35 | P3 |
| Group Detail | `/community/groups/[slug]` | Scrapbook | 65 | P4 |
| Group Create | `/community/groups/create` | FocusLayout | 145 | P2 |
| Help ID | `/community/help-id` | Explorer | 198 | P4 |
| Help ID Detail | `/community/help-id/[id]` | Scrapbook | 146 | P4 |
| Studio Landing | `/studio` | Explorer | 25 | P4 |
| Studio Dashboard | `/studio/dashboard` | CommandCenter | 94 | P3 |
| Studio Setup | `/studio/setup` | FocusLayout | 428 | P2 |
| Studio Profile | `/studio/[slug]` | Scrapbook | 285 | P4 |
| Studio My Commissions | `/studio/my-commissions` | Explorer | 106 | P3 |
| Commission Detail | `/studio/commission/[id]` | FocusLayout | 207 | P4 |
| Commission Request | `/studio/[slug]/request` | FocusLayout | 80 | P2 |
| Catalog Item | `/catalog/[id]` | Scrapbook | 179 | P4 |
| Catalog Changelog | `/catalog/changelog` | Explorer | 90 | P3 |
| Catalog Suggestions | `/catalog/suggestions` | Explorer | 190 | P3 |
| Catalog Suggestion Detail | `/catalog/suggestions/[id]` | FocusLayout | 298 | P2, P3 |
| Catalog New Suggestion | `/catalog/suggestions/new` | FocusLayout | 33 | P2 |
| Hoofprint | `/community/[id]/hoofprint` | Scrapbook | 108 | P4 |
| Collection | `/stable/collection/[id]` | Explorer | 258 | P3 |
| CSV Import | `/stable/import` | FocusLayout | 36 | P2, P3 |
| Discover | `/discover` | Explorer | 63 | P3 |
| Wishlist | `/wishlist` | Explorer | 181 | P3 |
| Upgrade | `/upgrade` | FocusLayout | 249 | P4 |
| Feed Post Detail | `/feed/[id]` | Scrapbook | 105 | P4 |
| Claim | `/claim` | FocusLayout | 242 | P2 |

## Tier 3 — Rare / Static (audit LAST, light touch)

| Page | Route | Notes | Lines |
|------|-------|-------|-------|
| Landing | `/` | Marketing — check mobile hero only | 509 |
| About | `/about` | Static | 186 |
| FAQ | `/faq` | Static | 225 |
| Terms | `/terms` | Static | 213 |
| Privacy | `/privacy` | Static | 234 |
| Contact | `/contact` | Static | 140 |
| Getting Started | `/getting-started` | Onboarding guide | 204 |
| Login | `/login` | Auth | 116 |
| Signup | `/signup` | Auth | 189 |
| Forgot Password | `/forgot-password` | Auth | 108 |
| Reset Password | `/auth/reset-password` | Auth | 173 |
| Auth Error | `/auth/auth-code-error` | Error page | 33 |
| Admin | `/admin` | Internal only | 134 |
| Quick Add | `/add-horse/quick` | Minimal form | 275 |
| Photo Share | `/photo/[slug]` | OG preview | 46 |
| Offline | `/~offline` | PWA fallback | 11 |
| Error | `/error` | Error boundary | — |
| Not Found | `/not-found` | 404 page | — |

## Cold Palette Violations Found

**60+ occurrences across these files** (first 60 shown):

| File | Violation Lines |
|------|----------------|
| `src/app/error.tsx` | 6 |
| `src/app/not-found.tsx` | 6 |
| `src/app/page.tsx` (landing) | 84,85,104,105,124,125,155,173,191,209,227,245,316,326,337,354,394,404,414,443,450,457,464,483 |
| `src/app/about/page.tsx` | 60,72,83,110,121,132,143,153,163,180 |
| `src/app/add-horse/page.tsx` | 568,623,677,715,1061,1064,1167,1442,1473,1495,1500 |
| `src/app/add-horse/quick/page.tsx` | 132,264,269 |
| `src/app/admin/page.tsx` | 111,116,121 |
| `src/app/auth/auth-code-error/page.tsx` | 25 |
| `src/app/auth/reset-password/page.tsx` | 82,98,123 |
| `src/app/catalog/page.tsx` | 93,124 |
| `src/app/catalog/changelog/page.tsx` | 75 |

> [!NOTE]
> Landing page (`/`) and About page have the most violations — these are marketing pages that predated the warm palette adoption. Tier 3 priority.

## Bare Native Form Elements

Only **3 instances** found:

| File | Line | Element |
|------|------|---------|
| `src/app/community/events/create/page.tsx` | 91 | `<select>` |
| `src/app/community/events/create/page.tsx` | 106 | `<select>` |
| `src/components/CreateShowForm.tsx` | 67 | `<select>` |

> [!TIP]
> All 3 are `<select>` elements that should migrate to the shadcn `<Select>` primitive for consistent focus rings and palette compliance.

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
