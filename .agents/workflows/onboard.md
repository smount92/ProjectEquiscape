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
| CSS | Vanilla CSS design system (`globals.css` + 19 CSS Modules + `studio.css` + `competition.css`) |
| Email | Resend |
| PDF | @react-pdf/renderer |
| Analytics | Google Analytics |

The platform has **56 routes**, **81 components**, **34 server action files**, and **56 database migrations** (001–060).

## Step 2 — Read the Current State Report

The most up-to-date overview of the entire project (every route, component, server action, migration, and feature):

```
View file: c:\Project Equispace\model-horse-hub\.agents\docs\model_horse_hub_state_report.md
```

If this file is stale, check the brain artifacts directory for a newer `model_horse_hub_full_state_report.md`.

## Step 3 — Read the Active Blueprint

The current active blueprint is the **Phase 6.5 Deep Polish & Hardening** workflow:

```
View file: c:\Project Equispace\model-horse-hub\.agents\workflows\v23-deep-polish.md
```

For historical context on the schema unification that brought us here:

```
View file: c:\Project Equispace\model-horse-hub\.agents\docs\Grand_Unification_Plan.md
```

## Step 4 — Understand Key Conventions

### Project Structure
```
src/
├── app/
│   ├── layout.tsx          # Root layout — Inter font, GA, SimpleModeProvider, Header
│   ├── globals.css         # 10,145 lines — design system tokens + shared component styles
│   ├── studio.css          # Art Studio styles
│   ├── competition.css     # Show/competition styles
│   ├── actions/            # 34 "use server" action files — ALL backend logic
│   ├── api/                # 5 API routes (auth, cron, export, identify-mold, reference-dictionary)
│   └── [route folders]/    # 50 page.tsx files across ~30 route groups
├── components/             # 81 client components + 19 CSS Modules
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

**CSS Architecture:**
- Design tokens in `:root` of `globals.css` — colors, spacing, radii, shadows, transitions
- Dark theme by default — deep purples/indigos (`#0a0a12`), violet accent (`#7c6df0`)
- Simple Mode: `[data-simple-mode="true"]` — 130% font scale, 60px min buttons
- **19 CSS Modules** for component-specific styles (ChatThread, OfferCard, DashboardShell, etc.)
- Shared primitives (`horse-card-*`, `btn-*`, `form-*`, `modal-*`, `feed-*`) stay in globals
- New components should use CSS Modules, not add to globals

**Database:**
- Migrations in `supabase/migrations/` — sequential numbering (currently at 060)
- Universal Catalog (`catalog_items`) — 10,500+ entries for molds, releases, artist resins, tack
- Universal Ledger — `v_horse_hoofprint` materialized view (UNION ALL across 5 source tables)
- Commerce State Machine — `transactions.status` has 6 states: `offer_made → pending_payment → funds_verified → completed` (+ `pending`, `cancelled`)
- Market Price Guide — `mv_market_prices` materialized view refreshed by cron

**Privacy Rules:**
- `financial_vault` is NEVER queried on public routes (only owner via RLS)
- Horse images in private `horse-images` bucket — use `getSignedImageUrl()` for rendering
- Watermark opt-in (`watermark_photos` boolean on users)
- Block system prevents interaction between blocked users

### Security
- Rate limiting via `checkRateLimit()` from `src/lib/utils/rateLimit.ts`
- `RISKY_PAYMENT_REGEX` in ChatThread warns about off-platform payment mentions
- Tombstone deletion (soft delete) for data integrity
- `after()` wraps in: `posts.ts`, `groups.ts`, `events.ts`, `activity.ts`
- Cryptographic PIN generation using `crypto.randomInt()` (not `Math.random()`)

## Step 5 — Explore the Codebase

Key entry points for understanding the code:

| Area | Start Here |
|------|-----------|
| Dashboard | `src/app/dashboard/page.tsx` |
| Add Horse (multi-step form) | `src/app/add-horse/page.tsx` |
| Public Passport | `src/app/community/[id]/page.tsx` |
| Commerce Flow | `src/app/actions/transactions.ts` (makeOffer → respondToOffer → markPaymentSent → verifyFundsAndRelease) |
| Chat + OfferCard | `src/app/inbox/[id]/page.tsx` + `src/components/OfferCard.tsx` |
| Horse CRUD | `src/app/actions/horse.ts` |
| Reference Search | `src/components/UnifiedReferenceSearch.tsx` |
| Feed | `src/app/feed/page.tsx` + `src/app/actions/activity.ts` |
| Design Tokens | `src/app/globals.css` lines 1–120 |

## Step 6 — Documentation Responsibility

This project maintains living documentation. After completing any feature work:

1. **Update the workflow file** — mark tasks `✅ DONE` with the date, check off checklist items
2. **Don't mark complete** unless `npx next build` passes with 0 errors
3. **Add brief notes** about issues encountered or design decisions made

## Step 7 — You're Ready

You are now oriented. Ask the user what they'd like to do, or check the active workflow (`/v23-deep-polish`) for pending tasks.
