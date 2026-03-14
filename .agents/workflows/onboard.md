---
description: Onboard to the Model Horse Hub project — read architecture, conventions, and current state before doing any work
---

# Onboard to Model Horse Hub

Run this workflow before starting ANY work on the project. It loads the full context into your session.

## Step 1 — Understand the Platform

Model Horse Hub is a **privacy-first digital stable and social platform** for model horse collectors. It runs on:

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.1.6 (App Router, Turbopack) |
| Language | TypeScript 5, React 19 |
| Database | Supabase (PostgreSQL + Row Level Security) |
| Auth | Supabase Auth (PKCE flow, cookie-based SSR) |
| Hosting | Vercel (serverless) |
| CSS | Vanilla CSS design system (`globals.css` ~11K lines + 19 CSS Modules + `studio.css` + `competition.css`) |
| Email | Resend |
| PDF | @react-pdf/renderer |
| Analytics | Google Analytics |

The platform has **56+ routes**, **80+ components**, **34 server action files**, and **70 database migrations** (001–070).

## Step 2 — Read the Current State Report

The most up-to-date overview of the entire project (every route, component, server action, migration, and feature):

```
View file: c:\Project Equispace\model-horse-hub\.agents\docs\model_horse_hub_state_report.md
```

For deep architecture understanding:

```
View file: c:\Project Equispace\model-horse-hub\.agents\docs\platform_architecture_deep_dive.md
```

## Step 3 — Read the Active Blueprint / Dev Queue

The current active development queue:

```
View file: c:\Project Equispace\model-horse-hub\.agents\workflows\dev-nextsteps.md
```

For the Phase 6 blueprint (the most recent major planning document):

```
View file: c:\Project Equispace\model-horse-hub\.agents\docs\Phase6_master_blueprint.md
```

For historical context on the schema unification that shaped the database:

```
View file: c:\Project Equispace\model-horse-hub\.agents\docs\Grand_Unification_Plan.md
```

## Step 4 — Understand Key Conventions

### Project Structure
```
src/
├── app/
│   ├── layout.tsx          # Root layout — Inter font, GA, SimpleModeProvider, Header
│   ├── globals.css         # ~11,000 lines — design system tokens + shared component styles
│   ├── studio.css          # Art Studio styles
│   ├── competition.css     # Show/competition styles
│   ├── actions/            # 34 "use server" action files — ALL backend logic
│   ├── api/                # API routes (auth, cron, export, identify-mold, reference-dictionary)
│   └── [route folders]/    # 50+ page.tsx files across ~30 route groups
├── components/             # 80+ client components + 19 CSS Modules
└── lib/
    ├── supabase/           # admin.ts (service role), client.ts (browser), server.ts (SSR)
    ├── types/              # database.ts (manual types), csv-import.ts
    ├── utils/              # imageCompression, mentions, rateLimit, storage, validation
    └── context/            # SimpleModeContext.tsx (accessibility)
```

### Coding Patterns — MUST Follow

**Server Components** (pages):
- Default export, `async function`, fetch data with `await createClient()` from `@/lib/supabase/server`
- Auth check: `const { data: { user } } = await supabase.auth.getUser()`
- RLS handles row-level access — no manual auth checks on SELECT queries for own data

**Server Actions** (`src/app/actions/*.ts`):
- Always `"use server"` at top
- Return `{ success: boolean; error?: string; [data]? }`
- Use `getAdminClient()` for cross-user writes (bypasses RLS)
- Use `revalidatePath()` after mutations
- Wrap background tasks in `after()` from `next/server` for serverless safety

**Client Components** (`src/components/*.tsx`):
- Always `"use client"` at top
- Use `useState` for loading/error states
- Import server actions directly — Next.js handles serialization
- Prefer CSS Modules (`styles.className`) for new components; shared classes stay in globals
- **Modals MUST use `createPortal(overlay, document.body)`** from `react-dom` to avoid CSS containment issues from parent transforms

**CSS Architecture:**
- Design tokens in `:root` of `globals.css` — colors, spacing, radii, shadows, transitions
- Warm earth-toned theme — cream/parchment background (`#faf6f0`), sage green accent (`#3d5a3e`), brown/leather tones
- Simple Mode: `[data-simple-mode="true"]` — 130% font scale, 60px min buttons
- **19 CSS Modules** for component-specific styles (ChatThread, OfferCard, DashboardShell, etc.)
- Shared primitives (`horse-card-*`, `btn-*`, `form-*`, `modal-*`, `feed-*`) stay in globals
- New components should use CSS Modules, not add to globals

**Database:**
- Migrations in `supabase/migrations/` — sequential numbering (currently at 070)
- Universal Catalog (`catalog_items`) — 10,500+ entries for molds, releases, artist resins, tack
- Universal Ledger — `v_horse_hoofprint` materialized view (UNION ALL across 5 source tables)
- Commerce State Machine — `transactions.status`: `offer_made → pending_payment → funds_verified → completed` (+ `pending`, `cancelled`)
- Market Price Guide — `mv_market_prices` materialized view refreshed by cron

**Privacy Rules:**
- `financial_vault` is NEVER queried on public routes (only owner via RLS)
- Horse images in private `horse-images` bucket — use `getSignedImageUrl()` for rendering
- Watermark opt-in (`watermark_photos` boolean on users)
- Block system prevents interaction between blocked users

### Header Navigation
- **Priority+ pattern** — items progressively collapse into a "More" dropdown as viewport shrinks
- Uses `ResizeObserver` to detect overflow and move items to hamburger menu
- Order: Stable, Show Ring, Feed, Discover, Shows, Art Studio → More (Market, Events, Groups, About, FAQ, etc.)

### Security
- Rate limiting via `checkRateLimit()` from `src/lib/utils/rateLimit.ts`
- `RISKY_PAYMENT_REGEX` in ChatThread warns about off-platform payment mentions
- Tombstone deletion (soft delete) for data integrity
- `after()` wraps in: `posts.ts`, `groups.ts`, `events.ts`, `activity.ts`
- Cryptographic PIN generation using `crypto.randomInt()` (not `Math.random()`)

## Step 5 — Explore the Codebase

Key entry points for understanding the code:

| Area | Start Here |
|------|-----------
| Dashboard | `src/app/dashboard/page.tsx` |
| Add Horse (multi-step form) | `src/app/add-horse/page.tsx` |
| Horse Passport (private) | `src/app/stable/[id]/page.tsx` |
| Public Passport | `src/app/community/[id]/page.tsx` |
| Commerce Flow | `src/app/actions/transactions.ts` |
| Chat + OfferCard | `src/app/inbox/[id]/page.tsx` + `src/components/OfferCard.tsx` |
| Horse CRUD | `src/app/actions/horse.ts` |
| Reference Search | `src/components/UnifiedReferenceSearch.tsx` |
| Feed | `src/app/feed/page.tsx` + `src/app/actions/activity.ts` |
| Header Nav | `src/components/Header.tsx` |
| Design Tokens | `src/app/globals.css` lines 1–120 |

## Step 6 — Documentation Responsibility

This project maintains living documentation. After completing any feature work:

1. **Update the workflow file** — mark tasks `✅ DONE` with the date, check off checklist items
2. **Don't mark complete** unless `npx next build` passes with 0 errors
3. **Add brief notes** about issues encountered or design decisions made

## Step 7 — You're Ready

You are now oriented. Ask the user what they'd like to do, or check the dev queue (`/dev-nextsteps`) for pending tasks.
