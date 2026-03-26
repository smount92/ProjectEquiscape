# Project Structure

> Annotated directory tree showing the purpose of every major folder and key files.

```
model-horse-hub/
│
├── .agents/                          # AI agent configuration and project management
│   ├── workflows/                    # 67 workflow documents (sprint plans, dev queue)
│   │   ├── onboard.md               # Agent onboarding — read before any work
│   │   ├── dev-nextsteps.md          # Living task queue — current dev priorities
│   │   ├── layout-unification-*.md   # Current: Layout Archetype migration
│   │   ├── ui-overhaul-*.md          # Current: shadcn/Framer Motion migration
│   │   └── v*.md                     # Historical sprint records (v1–v39)
│   └── docs/                         # Strategic planning documents
│       ├── Open_Beta_Plan.md         # 3-phase infrastructure hardening plan
│       ├── UI_Update_Plan.md         # "Cozy Scrapbook" design overhaul
│       ├── Layout_Unification.md     # 4 Page Archetype unification blueprint
│       └── *.md                      # Grand Unification Plan, Phase6 blueprint, etc.
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
├── e2e/                              # Playwright E2E test specs
│   ├── smoke.spec.ts                 # Basic page load verification
│   ├── auth.spec.ts                  # Login/signup/password reset flows
│   ├── inventory.spec.ts             # Horse CRUD operations
│   ├── safe-trade.spec.ts            # Commerce state machine E2E
│   ├── hoofprint-transfer.spec.ts    # Ownership transfer flow
│   ├── show-entry.spec.ts            # Show entry submission
│   ├── accessibility.spec.ts         # axe-core WCAG audits
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
│   └── migrations/                   # 98 sequential SQL migration files (001–102)
│       ├── 001_initial_schema.sql    # Core tables (users, user_horses, etc.)
│       ├── ...                       # Feature additions, schema changes
│       ├── 098_soft_delete_horses.sql # Tombstone soft-delete
│       ├── 099_commerce_locks.sql    # Atomic commerce RPCs
│       ├── 100_fuzzy_search_rpc.sql  # pg_trgm fuzzy search
│       ├── 101_trusted_sellers.sql   # Trusted seller materialized view
│       └── 102_pro_rls.sql           # Pro tier RLS functions
│
├── src/                              # Application source code
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout — Inter + Playfair Display, GA, SimpleModeProvider, Header
│   │   ├── page.tsx                  # Landing page (public marketing storefront)
│   │   ├── globals.css               # ~2,220 lines — Tailwind v4 @theme tokens + shared primitives
│   │   │
│   │   ├── actions/                  # 36 server action files — ALL backend logic
│   │   │   ├── horse.ts              # Core CRUD — create, update, soft-delete horses
│   │   │   ├── transactions.ts       # Commerce state machine (offers, payments)
│   │   │   ├── hoofprint.ts          # Provenance timeline, transfers
│   │   │   ├── art-studio.ts         # Artist profiles, commissions, WIP
│   │   │   ├── catalog-suggestions.ts # Catalog curation — browse, suggest, vote, review
│   │   │   ├── competition.ts        # Events, divisions, classes, judging
│   │   │   ├── groups.ts             # Group CRUD, membership, files
│   │   │   ├── events.ts             # Event CRUD, RSVP, photos
│   │   │   ├── shows.ts              # Photo shows, voting, results
│   │   │   ├── posts.ts              # Social posts, comments, media
│   │   │   ├── messaging.ts          # DM conversations, messages
│   │   │   ├── activity.ts           # Activity feed generation
│   │   │   └── *.ts                  # 24 more domain-specific action files
│   │   │
│   │   ├── api/                      # 10 API routes (non-action endpoints)
│   │   │   ├── auth/callback/        # Supabase PKCE code exchange
│   │   │   ├── auth/me/              # Current user session check
│   │   │   ├── checkout/             # Stripe Checkout Session creation
│   │   │   ├── webhooks/stripe/      # Stripe webhook (subscription events)
│   │   │   ├── cron/refresh-market/  # Daily materialized view refresh
│   │   │   ├── cron/stablemaster-agent/ # Monthly AI collection analysis
│   │   │   ├── export/[horseId]/     # CoA/parked export PDF generation
│   │   │   ├── insurance-report/     # Insurance report PDF generation
│   │   │   ├── identify-mold/        # AI mold identification
│   │   │   └── reference-dictionary/ # Reference data for search
│   │   │
│   │   └── [route folders]/          # 35 route groups → 60 page.tsx files
│   │       ├── dashboard/            # Private authenticated dashboard
│   │       ├── stable/[id]/          # Private horse passport (Scrapbook layout)
│   │       ├── community/            # Public Show Ring + public passport
│   │       ├── feed/                 # Activity feed
│   │       ├── inbox/                # Direct messaging
│   │       ├── market/               # Blue Book price guide
│   │       ├── shows/                # Competition center
│   │       ├── studio/               # Art Studio (artist profiles, commissions)
│   │       ├── catalog/              # Catalog browser, suggestions, changelog
│   │       ├── discover/             # Discover collectors
│   │       ├── profile/[alias_name]/ # Public user profiles
│   │       ├── admin/                # Admin console
│   │       ├── settings/             # User settings
│   │       ├── upgrade/              # Pro tier pricing + Stripe checkout
│   │       └── ...                   # auth, contact, about, faq, etc.
│   │
│   ├── components/                   # 107 client components
│   │   ├── ui/                       # 8 shadcn/ui primitives
│   │   │   ├── button.tsx            # Button variants (default, outline, ghost, destructive)
│   │   │   ├── input.tsx             # Text input
│   │   │   ├── select.tsx            # Select dropdown (Radix)
│   │   │   ├── textarea.tsx          # Textarea
│   │   │   ├── badge.tsx             # Status/tag badges
│   │   │   ├── dialog.tsx            # Modal dialog (Radix)
│   │   │   ├── skeleton.tsx          # Loading skeleton
│   │   │   └── separator.tsx         # Visual separator
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
│   │   └── pdf/                      # PDF generation (insurance, CoA)
│   │
│   ├── lib/                          # Shared libraries and utilities
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
│   └── __tests__/                    # Unit + integration test files (245 tests)
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
├── vercel.json                       # Vercel deployment config (cron schedules)
└── Model Horse Hub Complete Report.md # Comprehensive project report
```

## Key Concepts

### Server Actions as the Backend

There is **no separate API layer** for application logic. All backend logic lives in 36 `"use server"` files under `src/app/actions/`. Next.js handles serialization between client and server. Client components import server actions directly. API routes exist only for external integrations (Stripe webhooks, cron jobs, PDF generation).

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
