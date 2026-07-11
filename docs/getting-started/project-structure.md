# Project Structure

> Annotated directory tree showing the purpose of every major folder and key files.

```
model-horse-hub/
│
├── .agents/                          # AI agent configuration and project management
│   ├── MASTER_BLUEPRINT.md           # Iron Laws, tech decisions, architecture — read FIRST
│   ├── MASTER_SUPABASE.md            # Schema/RLS/RPC reference — read SECOND
│   ├── workflows/                    # ~29 active workflow documents (sprint plans, dev queue)
│   │   ├── onboard.md               # Agent onboarding — read before any work
│   │   ├── dev-nextsteps.md          # Living task queue — current dev priorities
│   │   └── v*.md                     # Historical sprint records (v1–v44)
│   └── docs/                         # Strategic planning documents
│       └── *.md                      # Grand Unification Plan, master blueprints, audits, etc.
│
├── docs/                             # Developer documentation
│   ├── getting-started/              # Setup, project structure, test accounts
│   ├── guides/                       # Design system, testing guides
│   ├── architecture/                 # Architecture overview
│   ├── api/                          # API route documentation
│   ├── components/                   # Component documentation
│   ├── database/                     # Schema, migrations, seed data
│   └── routes/                       # Route documentation
│
├── e2e/                              # 9 Playwright E2E test specs
│   ├── smoke.spec.ts                 # Basic page load verification
│   ├── auth.spec.ts                  # Login/signup/password reset flows
│   ├── inventory.spec.ts             # Horse CRUD operations
│   ├── safe-trade.spec.ts            # Commerce state machine E2E
│   ├── hoofprint-transfer.spec.ts    # Ownership transfer flow
│   ├── show-entry.spec.ts            # Show entry submission
│   ├── accessibility.spec.ts         # axe-core WCAG 2.0 AA audits
│   ├── device-layout.spec.ts         # 60-viewport device matrix
│   ├── visual-qa-mobile.spec.ts      # Mobile visual QA sweep
│   └── helpers/                      # Shared E2E utilities
│
├── public/                           # Static assets served at /
│   └── (favicon, fonts, static images)
│
├── scripts/                          # Data scraping and seeding scripts
│   ├── scrape_breyer_molds.mjs       # Scrapes Breyer mold data
│   ├── scrape_releases.mjs           # Scrapes Breyer release data
│   ├── scrape_erd.mjs                # Scrapes Equine Resin Directory
│   ├── seed_releases.mjs             # Seeds releases into catalog_items
│   ├── seed_erd_resins.mjs           # Seeds ERD resins into catalog_items
│   └── *.mjs                         # Other data processing scripts
│
├── supabase/
│   └── migrations/                   # 119 sequential SQL migration files (001–123; some numbers skipped)
│       ├── 001_initial_schema.sql    # Core tables (users, user_horses, etc.)
│       ├── ...                       # Feature additions, schema changes
│       ├── 116_platform_generated_verification_tier.sql
│       ├── 117_shows_domain.sql      # Shows v2 — root domain schema (10 new tables)
│       ├── 118_shows_domain_rls.sql  # Shows v2 — RLS + role/verification RPCs
│       ├── 119_shows_online_judging.sql # Community voting (show_entry_votes)
│       ├── 120_cards_safe_trade_hook.sql # Qualification cards follow the horse on sale
│       ├── 121_group_files_bucket.sql # Notice Board file-sharing storage bucket
│       ├── 122_groups_forum.sql      # Notice Board threads (group_last_read, posts.title/bumped_at)
│       └── 123_stable_filters.sql    # Stable v2 (stable_saved_views, facet/summary RPCs)
│
├── src/                              # Application source code
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout — Inter + Playfair Display, GA, SimpleModeProvider, Header
│   │   ├── page.tsx                  # Landing page (public marketing storefront)
│   │   ├── globals.css               # ~1,750 lines — Tailwind v4 @theme tokens + shared primitives
│   │   │
│   │   ├── actions/                  # 42 server action files — ALL backend logic
│   │   │   ├── horse.ts              # Core CRUD — create, update, soft-delete horses
│   │   │   ├── transactions.ts       # Commerce state machine (offers, payments)
│   │   │   ├── hoofprint.ts          # Provenance timeline, transfers
│   │   │   ├── art-studio.ts         # Artist profiles, commissions, WIP
│   │   │   ├── catalog-suggestions.ts # Catalog curation — browse, suggest, vote, review
│   │   │   ├── competition.ts        # Legacy photo-show engine — divisions, classes, judging (KEEP — serves real-world show entrants, not dead code)
│   │   │   ├── groups.ts             # Group CRUD, membership, files
│   │   │   ├── groups-forum.ts       # Notice Board — threads/channels/pinned posts (flag NEXT_PUBLIC_GROUPS_FORUM)
│   │   │   ├── events.ts             # Event CRUD, RSVP, photos
│   │   │   ├── shows.ts              # Legacy photo shows, voting, results
│   │   │   ├── shows-v2.ts           # Shows v2 — live+online competition domain (flag NEXT_PUBLIC_SHOWS_V2)
│   │   │   ├── shows-v2-ring.ts      # Shows v2 — live ring console (leg tags, callbacks)
│   │   │   ├── showring.ts           # Show Ring v2 — judging/spectator surface (flag NEXT_PUBLIC_SHOWRING_V2)
│   │   │   ├── stable.ts             # Stable v2 — faceted filters + saved views (flag NEXT_PUBLIC_STABLE_V2)
│   │   │   ├── posts.ts              # Social posts, comments, media
│   │   │   ├── messaging.ts          # DM conversations, messages
│   │   │   ├── activity.ts           # Activity feed generation
│   │   │   └── *.ts                  # ~27 more domain-specific action files
│   │   │
│   │   ├── api/                      # 18 API routes (non-action endpoints) + /auth/callback
│   │   │   ├── auth/me/              # Current user session check
│   │   │   ├── checkout/             # Stripe Checkout Session creation (Pro subscription)
│   │   │   ├── checkout/promote/     # Stripe: Promoted listing purchase
│   │   │   ├── checkout/boost-iso/   # Stripe: ISO feed bounty purchase
│   │   │   ├── checkout/insurance-report/ # Stripe: A-la-carte insurance report
│   │   │   ├── checkout/studio-pro/  # Stripe: Studio Pro artist tier
│   │   │   ├── webhooks/stripe/      # Stripe webhook (subscription events)
│   │   │   ├── cron/refresh-market/  # Daily materialized view refresh
│   │   │   ├── cron/stablemaster-agent/ # Monthly AI collection analysis
│   │   │   ├── cron/transition-shows/ # Auto-transition expired shows (6h)
│   │   │   ├── export/               # CoA/parked export PDF generation
│   │   │   ├── export/show-tags/     # Show tag PDF generation (Pro)
│   │   │   ├── export/nan-cards/     # NAN card CSV export for collectors
│   │   │   ├── export/show-results/[eventId]/    # Legacy photo-show results export
│   │   │   ├── export/show-results-v2/[showId]/  # Shows v2 NAMHSA-format results export
│   │   │   ├── insurance-report/     # Insurance report PDF generation
│   │   │   ├── identify-mold/        # AI mold identification
│   │   │   └── reference-dictionary/ # Reference data for search
│   │   │   (PKCE code exchange lives at src/app/auth/callback/route.ts, outside /api)
│   │   │
│   │   └── [route folders]/          # → 73 page.tsx files
│   │       ├── dashboard/            # Private authenticated dashboard
│   │       ├── stable/[id]/          # Private horse passport (Scrapbook layout)
│   │       ├── community/            # Public Show Ring + public passport
│   │       ├── feed/                 # Activity feed
│   │       ├── inbox/                # Direct messaging
│   │       ├── market/               # Blue Book price guide
│   │       ├── shows/                # Competition center (legacy photo shows + Shows v2)
│   │       ├── cards/[code]/         # Public qualification-card verification page
│   │       ├── studio/               # Art Studio (artist profiles, commissions)
│   │       ├── catalog/              # Catalog browser, suggestions, changelog
│   │       ├── discover/             # Discover collectors
│   │       ├── profile/[alias_name]/ # Public user profiles
│   │       ├── admin/                # Admin console
│   │       ├── settings/             # User settings
│   │       ├── upgrade/              # Pro tier pricing + Stripe checkout
│   │       └── ...                   # auth, contact, about, faq, etc.
│   │
│   ├── components/                   # ~175 client components (`"use client"` files)
│   │   ├── ui/                       # 11 shadcn/ui primitives
│   │   │   ├── button.tsx            # Button variants (default, outline, ghost, destructive)
│   │   │   ├── input.tsx             # Text input
│   │   │   ├── select.tsx            # Select dropdown (Radix)
│   │   │   ├── textarea.tsx          # Textarea
│   │   │   ├── badge.tsx             # Status/tag badges
│   │   │   ├── card.tsx              # Card container
│   │   │   ├── dialog.tsx            # Modal dialog (Radix)
│   │   │   ├── popover.tsx           # Popover (Radix)
│   │   │   ├── skeleton.tsx          # Loading skeleton
│   │   │   ├── separator.tsx         # Visual separator
│   │   │   └── table.tsx             # Data table
│   │   │
│   │   ├── layouts/                  # 4 Page Archetype wrappers
│   │   │   ├── ExplorerLayout.tsx    # Browsing grids (max-w-7xl, sticky filters)
│   │   │   ├── ScrapbookLayout.tsx   # Split-view details (1.5fr/1fr, sticky sidebar)
│   │   │   ├── CommandCenterLayout.tsx # Dashboards (max-w-[1600px], main+sidebar)
│   │   │   └── FocusLayout.tsx       # Forms/data entry (max-w-2xl, centered)
│   │   │
│   │   ├── Header.tsx                # Priority+ nav with ResizeObserver
│   │   ├── DashboardShell.tsx        # Stable grid, search, view toggles
│   │   ├── StableGrid.tsx            # Horse card grid with sorting/filtering
│   │   ├── UniversalFeed.tsx         # Activity feed with infinite scroll
│   │   ├── ShowStringManager.tsx     # Show string planning (largest component)
│   │   ├── EmptyState.tsx            # Standardized empty states with icons
│   │   ├── UpgradeButton.tsx         # Pro tier upgrade CTA
│   │   └── pdf/                      # 3 PDF components (@react-pdf/renderer)
│   │       ├── ShowTags.tsx           # Show tag PDF with QR codes
│   │       ├── InsuranceReport.tsx    # Insurance report PDF
│   │       └── CertificateOfAuthenticity.tsx # CoA/parked export PDF
│   │
│   ├── lib/                          # Shared libraries and utilities
│   │   ├── shows/                    # Shows v2 domain lib — pure, unit-tested (state machine, entry rules, card issuance/verification, callback ladders, NAMHSA results export, offline ring retry queue)
│   │   ├── groups/                   # Notice Board domain lib — thread schemas, flags, types
│   │   ├── stable/                   # Stable v2 domain lib — filter-param parsing, badges, schemas
│   │   ├── showring/                 # Show Ring v2 domain lib — filter params, flags, schemas
│   │   ├── commerce/                 # Safe-Trade domain lib — state machine, schemas
│   │   ├── supabase/
│   │   │   ├── admin.ts              # Service role client (bypasses RLS)
│   │   │   ├── client.ts             # Browser client (direct storage uploads)
│   │   │   └── server.ts             # SSR client (cookie-based auth)
│   │   ├── types/
│   │   │   ├── database.ts           # Generated TypeScript types for DB schema
│   │   │   └── csv-import.ts         # CSV import type definitions
│   │   ├── utils/
│   │   │   ├── achievements.ts       # Badge/achievement evaluation logic
│   │   │   ├── achievements-cron.ts  # Cron-triggered achievement processing
│   │   │   ├── imageCompression.ts   # Client-side image optimization
│   │   │   ├── mentions.ts           # @mention parsing
│   │   │   ├── rateLimit.ts          # Database-backed rate limiter
│   │   │   ├── storage.ts            # Signed URL helpers
│   │   │   └── validation.ts         # Input validation helpers
│   │   ├── context/
│   │   │   └── SimpleModeContext.tsx  # Accessibility: 130% fonts, 60px buttons
│   │   ├── auth.ts                   # requireAuth() helper
│   │   ├── email.ts                  # Resend email sending
│   │   ├── logger.ts                 # Structured logging (replaces silent catch)
│   │   ├── safety.ts                 # Content safety checks
│   │   └── utils.ts                  # cn() utility (clsx + tailwind-merge)
│   │
│   └── __tests__/                    # Unit + integration test files (1,031 tests across 71 files)
│       └── mocks/
│           └── supabase.ts           # Supabase mock factory for tests
│
├── .env.local                        # Environment variables (GITIGNORED)
├── package.json                      # Dependencies and scripts
├── tsconfig.json                     # TypeScript configuration (strict mode)
├── next.config.ts                    # Next.js configuration
├── vitest.config.ts                  # Vitest test runner config
├── playwright.config.ts              # Playwright E2E config
├── eslint.config.mjs                 # ESLint rules
└── vercel.json                       # Vercel deployment config (cron schedules)
```

> The old root-level "Model Horse Hub Complete Report.md" (April 2026 snapshot) has been
> archived to `.agents/archive/2026-Q2/` — it's a point-in-time report, not living
> documentation. For current state, start at `docs/README.md` or `.agents/MASTER_BLUEPRINT.md`.

## Key Concepts

### Server Actions as the Backend

There is **no separate API layer** for application logic. All backend logic lives in 42 `"use server"` files under `src/app/actions/`. Next.js handles serialization between client and server. Client components import server actions directly. API routes exist only for external integrations (Stripe webhooks, cron jobs, PDF generation). New action files should follow the zod → `requireAuth()` → ownership check → RLS-first pattern (see `CONTRIBUTING.md`), with business logic factored into a `src/lib/<domain>/` module rather than inlined.

### Three Supabase Clients

| Client | File | Usage |
|--------|------|-------|
| **Server** | `lib/supabase/server.ts` | SSR pages — reads cookies for auth |
| **Client** | `lib/supabase/client.ts` | Browser — direct storage uploads |
| **Admin** | `lib/supabase/admin.ts` | Service role — bypasses RLS for cross-user writes |

### CSS & UI Architecture

| Layer | Technology | Purpose |
|-------|-----------|---------|
| **Design tokens** | Tailwind CSS v4 `@theme` block | Colors, spacing, radii, shadows — `globals.css` lines 1–47 |
| **Shared primitives** | `globals.css` | Animations, responsive overrides, show record timeline dots |
| **Form inputs** | shadcn/ui `<Input>`, `<Textarea>`, `<Select>` | All form elements use Radix-based components |
| **Modals** | shadcn/ui `<Dialog>` | All modals except PhotoLightbox |
| **Status indicators** | shadcn/ui `<Badge>` | Finish types, trade status, ribbons |
| **Page containers** | Layout Archetypes in `src/components/layouts/` | 4 reusable wrappers for consistent max-widths and spacing |

**Convention:** Use shadcn/ui components for all interactive elements. Use Tailwind utility classes for layout. Use `globals.css` only for complex pseudo-element patterns (timeline dots, vault reveal bars). Never use inline `style={{...}}` for layout.

---

**Next:** [Setup](setup.md) · [Architecture Overview](../architecture/overview.md)
