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
| CSS | Tailwind CSS v4 (`@theme` tokens) + `globals.css` (~2,220 lines for primitives) |
| UI Components | shadcn/ui (Radix UI primitives — Button, Input, Select, Textarea, Badge, Dialog, Skeleton, Separator) |
| Animations | Framer Motion (spring physics, staggered reveals) |
| Payments | Stripe (Checkout Sessions + webhooks for subscription billing) |
| AI | Google Gemini (Stablemaster collection analysis) |
| Email | Resend |
| PDF | @react-pdf/renderer |
| Analytics | Google Analytics |

The platform has **60 page routes**, **107+ client components** (incl. 8 shadcn ui primitives), **36 server action files**, **10 API routes**, and **98 database migrations** (001–102).

### ⚠️ Development Environment: Windows + PowerShell

This project runs on **Windows** using **PowerShell** as the shell. Key gotchas:
- Use `cmd /c "npx next build 2>&1"` to capture combined stdout/stderr from npm scripts
- Avoid `$()` subshells and backtick escapes — use `-File` flag with `.ps1` scripts for complex commands
- Use double quotes `"` for outer strings and single quotes `'` for inner strings (opposite of bash)
- Pipe to `| Select-Object -Last N` instead of `| tail -n N`
- For `grep`-like searches, use `Select-String -Path "src\**\*.tsx" -Pattern "search-term" -List`
- For file counts: `(Get-ChildItem -Recurse -Filter '*.tsx' -Path 'src\app').Count`

## Step 2 — Read the Current State Report

The most up-to-date overview of the entire project (every route, component, server action, migration, and feature):

```
View file: Model Horse Hub Complete Report.md
```

For deep architecture understanding:

```
View file: .agents\docs\platform_architecture_deep_dive.md
```

## Step 3 — Read the Active Blueprint / Dev Queue

The current active development queue:

```
View file: .agents\workflows\dev-nextsteps.md
```

For strategic planning documents:

```
View files in: .agents\docs\
Key docs: Open_Beta_Plan.md, UI_Update_Plan.md, Layout_Unification.md
```

For historical context on the schema unification that shaped the database:

```
View file: .agents\docs\Grand_Unification_Plan.md
```

## Step 4 — Understand Key Conventions

### Project Structure
```
src/
├── app/
│   ├── layout.tsx          # Root layout — Inter + Playfair Display, GA, SimpleModeProvider, Header
│   ├── globals.css         # ~2,220 lines — Tailwind v4 @theme tokens + shared component styles
│   ├── actions/            # 36 "use server" action files — ALL backend logic
│   ├── api/                # 10 API routes (auth, cron, checkout, webhooks, export, identify-mold)
│   └── [route folders]/    # 60 page.tsx files across ~35 route groups
├── components/             # 107+ client components
│   ├── ui/                 # 8 shadcn/ui primitives (button, input, select, textarea, badge, dialog, skeleton, separator)
│   ├── layouts/            # 4 Page Archetype wrappers (Explorer, Scrapbook, CommandCenter, Focus)
│   ├── EmptyState.tsx      # Standardized empty state component
│   └── *.tsx               # Domain-specific components
└── lib/
    ├── supabase/           # admin.ts (service role), client.ts (browser), server.ts (SSR)
    ├── types/              # database.ts (generated types), csv-import.ts
    ├── utils/              # imageCompression, mentions, rateLimit, storage, validation, cn
    ├── utils.ts            # cn() utility (clsx + tailwind-merge)
    └── context/            # SimpleModeContext.tsx (accessibility)
```

### Coding Patterns — MUST Follow

**Server Components** (pages):
- Default export, `async function`, fetch data with `await createClient()` from `@/lib/supabase/server`
- Auth check: use `requireAuth()` from `@/lib/auth` (returns user or redirects)
- RLS handles row-level access — no manual auth checks on SELECT queries for own data

**Server Actions** (`src/app/actions/*.ts`):
- Always `"use server"` at top
- Return `{ success: boolean; error?: string; [data]? }`
- Use `getAdminClient()` for cross-user writes (bypasses RLS)
- Use `revalidatePath()` after mutations
- Wrap background tasks in `after()` from `next/server` for serverless safety
- Use `logger.error()` (from `@/lib/logger`) for error handling — NEVER use silent `catch {}`

**Client Components** (`src/components/*.tsx`):
- Always `"use client"` at top
- Use `useState` for loading/error states
- Import server actions directly — Next.js handles serialization
- **Use shadcn/ui** for inputs, buttons, selects, textareas, badges, and dialogs
- **Use `<Dialog>` from `@/components/ui/dialog`** for modals (NOT `createPortal`). Exception: `PhotoLightbox.tsx` retains `createPortal` for its custom keyboard nav
- **Use Framer Motion** for tactile animations (`whileTap`, `whileHover`, `staggerChildren`)

**CSS & Styling Architecture:**
- **Tailwind CSS v4** with `@theme` block in `globals.css` for design tokens
- **shadcn/ui** for form primitives — no `form-input` or `form-select` classes
- **No inline `style={{...}}`** for layout, padding, or colors
- Warm "Cozy Scrapbook" theme — parchment background (`#F0EAD6`), forest green accent (`#2C5545`), espresso text (`#2D2318`)
- Simple Mode: `[data-simple-mode="true"]` — 130% font scale, 60px min buttons
- Typography: `font-serif` (Playfair Display) for headings, `font-sans` (Inter) for UI text
- Design System Guide: `docs/guides/design-system.md`

**Page Layouts — Use Archetypes:**
- **ExplorerLayout** — browsing grids with sticky filters (Show Ring, Market, Catalog...)
- **ScrapbookLayout** — split-view details (Horse Passport, Studio Profile...)
- **CommandCenterLayout** — dashboards with sidebar (Stable Dashboard, Admin...)
- **FocusLayout** — forms and data entry (Add Horse, Login, Settings...)
- NEVER create custom `max-w-[var(--max-width)] mx-auto px-6` wrapper divs on pages

**Database:**
- Migrations in `supabase/migrations/` — sequential numbering (currently at 102)
- Universal Catalog (`catalog_items`) — 10,500+ entries for molds, releases, artist resins, tack
- Universal Ledger — `v_horse_hoofprint` regular view (UNION ALL across 6 source tables) with `security_invoker = true`
- Commerce State Machine — `transactions.status`: `offer_made → pending_payment → funds_verified → completed` (+ `pending`, `cancelled`)
- Market Price Guide — `mv_market_prices` materialized view refreshed by cron (`authenticated` only, no `anon`)
- Trusted Sellers — `mv_trusted_sellers` materialized view (≥3 transactions, ≥4.5 avg rating)
- Soft Delete — `deleted_at` tombstone column on `user_horses` (NOT hard delete)
- Atomic Commerce — `make_offer_atomic` and `respond_to_offer_atomic` RPCs with `FOR UPDATE` row-locking
- Fuzzy Search — `search_catalog_fuzzy` RPC using `pg_trgm`
- Pro Tier — `get_user_tier()`, `get_photo_limit()`, `get_extra_photo_count()` functions
- All SECURITY DEFINER functions use `SET search_path = ''` with fully qualified `public.table_name` references
- `pg_trgm` extension lives in the `extensions` schema (not `public`)
- All RLS policies use `(SELECT auth.uid())` (InitPlan pattern) for performance

**Monetization:**
- Freemium tier system (Free vs Pro) — JWT `app_metadata.tier`
- Stripe Checkout Sessions via `/api/checkout`
- Stripe Webhook handler at `/api/webhooks/stripe`
- Pro features: Photo Suite+ (30 extra photos), Blue Book PRO charts, Smart Insurance Reports, Stablemaster AI

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
- Tier gating: JWT `app_metadata.tier` checked server-side

## Step 5 — Explore the Codebase

Key entry points for understanding the code:

| Area | Start Here |
|------|-----------|
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
| Stripe Checkout | `src/app/api/checkout/route.ts` + `src/app/upgrade/page.tsx` |
| Design Tokens | `src/app/globals.css` lines 1–47 (`@theme` block) |
| shadcn Components | `src/components/ui/` |
| Layout Archetypes | `src/components/layouts/` |

## Step 6 — Documentation Responsibility

This project maintains living documentation. After completing any feature work:

1. **Update the workflow file** — mark tasks `✅ DONE` with the date, check off checklist items
2. **Don't mark complete** unless `npx next build` passes with 0 errors
3. **Add brief notes** about issues encountered or design decisions made

## Step 6.5 — Testing Policy

This project follows a **"test with each feature"** convention:

- **Utility functions** (`src/lib/utils/`) — Write unit tests in `src/lib/utils/__tests__/`. Pure functions are the highest-ROI tests.
- **Critical server actions** — When modifying `transactions.ts`, `hoofprint.ts`, `horse.ts`, `collections.ts`, or `competition.ts`, add or update integration tests using the Supabase mock factory (`src/__tests__/mocks/supabase.ts`).
- **New features** — If a feature involves a state machine, complex validation, or financial data, it needs test coverage before merge.
- **Don't test rendering** — Component tests (React Testing Library) are deferred in favor of E2E Playwright tests for user flows.

**Commands:**
```bash
npm run test:unit          # Vitest unit/integration tests
npm run test:unit:watch    # Watch mode during development
npm run test:unit:coverage # Coverage report
npm run test:e2e           # Playwright E2E (needs dev server)
```

## Step 7 — You're Ready

You are now oriented. Ask the user what they'd like to do, or check the dev queue (`/dev-nextsteps`) for pending tasks.
