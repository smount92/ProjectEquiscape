# Project Structure

> Annotated directory tree showing the purpose of every major folder and key files.

```
model-horse-hub/
│
├── .agents/                          # AI agent configuration and project management
│   ├── workflows/                    # 57 workflow documents (sprint plans, dev queue)
│   │   ├── onboard.md               # Agent onboarding — read before any work
│   │   ├── dev-nextsteps.md          # Living task queue — current dev priorities
│   │   └── v*.md                     # Historical sprint records (v1–v31)
│   └── docs/                         # Strategic planning documents
│       ├── model_horse_hub_state_report.md   # Comprehensive feature + research brief
│       ├── platform_architecture_deep_dive.md # Future architecture vision
│       └── *.md                      # QA worksheets, blueprints, feedback
│
├── docs/                             # Developer documentation (you are here)
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
│   └── migrations/                   # 86+ sequential SQL migration files
│       ├── 001_initial_schema.sql    # Core tables (users, user_horses, etc.)
│       ├── ...                       # Feature additions, schema changes
│       └── 091_catalog_curation.sql  # Latest migration (catalog curation)
│
├── src/                              # Application source code
│   ├── app/                          # Next.js App Router
│   │   ├── layout.tsx                # Root layout — Inter font, GA, SimpleModeProvider, Header
│   │   ├── page.tsx                  # Landing page (public marketing storefront)
│   │   ├── globals.css               # ~11K lines — design tokens + shared component styles
│   │   ├── studio.css                # Art Studio feature styles
│   │   ├── competition.css           # Show/competition feature styles
│   │   │
│   │   ├── actions/                  # 36 server action files — ALL backend logic
│   │   │   ├── horse.ts              # Core CRUD — create, update, delete horses
│   │   │   ├── transactions.ts       # Commerce state machine (offers, payments)
│   │   │   ├── hoofprint.ts          # Provenance timeline, transfers
│   │   │   ├── art-studio.ts         # Artist profiles, commissions, WIP
│   │   │   ├── catalog-suggestions.ts # Catalog curation (V32) — browse, suggest, vote, review
│   │   │   ├── competition.ts        # Events, divisions, classes, judging
│   │   │   ├── groups.ts             # Group CRUD, membership, files
│   │   │   ├── events.ts             # Event CRUD, RSVP, photos
│   │   │   ├── shows.ts              # Photo shows, voting, results
│   │   │   ├── posts.ts              # Social posts, comments, media
│   │   │   ├── messaging.ts          # DM conversations, messages
│   │   │   ├── activity.ts           # Activity feed generation
│   │   │   └── *.ts                  # 24 more domain-specific action files
│   │   │
│   │   ├── api/                      # API routes (non-action endpoints)
│   │   │   ├── auth/callback/        # Supabase PKCE code exchange
│   │   │   ├── cron/refresh-market/  # Daily materialized view refresh
│   │   │   ├── export/[horseId]/     # CoA/parked export PDF generation
│   │   │   ├── identify-mold/        # AI mold identification (feature-flagged)
│   │   │   └── reference-dictionary/ # Reference data for search
│   │   │
│   │   └── [route folders]/          # 28 route groups → page.tsx files
│   │       ├── dashboard/            # Private authenticated dashboard
│   │       ├── stable/[id]/          # Private horse passport
│   │       ├── community/            # Public Show Ring + public passport
│   │       ├── feed/                 # Activity feed
│   │       ├── inbox/                # Direct messaging
│   │       ├── market/               # Blue Book price guide
│   │       ├── shows/                # Competition center
│   │       ├── studio/               # Art Studio (artist profiles, commissions)
│   │       ├── reference/            # Catalog browser, suggestions, changelog (V32)
│   │       ├── discover/             # Discover collectors
│   │       ├── profile/[alias_name]/ # Public user profiles
│   │       ├── admin/                # Admin console
│   │       ├── settings/             # User settings
│   │       └── ...                   # auth, contact, about, faq, etc.
│   │
│   ├── components/                   # 116 client components
│   │   ├── Header.tsx                # Priority+ nav with ResizeObserver
│   │   ├── DashboardShell.tsx        # Two-column layout, search, view toggles
│   │   ├── StableGrid.tsx            # Horse card grid with sorting/filtering
│   │   ├── UniversalFeed.tsx         # Activity feed with infinite scroll
│   │   ├── ShowStringManager.tsx     # Show string planning (largest component)
│   │   ├── CsvImport.tsx             # Batch import wizard
│   │   ├── CommissionTimeline.tsx     # Commission lifecycle UI
│   │   ├── CatalogBrowser.tsx        # Catalog search/filter/sort/paginate (V32)
│   │   ├── SuggestEditModal.tsx      # Catalog edit suggestion modal (V32)
│   │   ├── SuggestionVoteButtons.tsx # Optimistic up/down voting (V32)
│   │   ├── SuggestionCommentThread.tsx # Discussion threads (V32)
│   │   ├── SuggestionAdminActions.tsx # Admin approve/reject UI (V32)
│   │   ├── *.module.css              # 19 co-located CSS Modules
│   │   └── pdf/                      # PDF generation components (insurance, CoA)
│   │
│   ├── lib/                          # Shared libraries and utilities
│   │   ├── supabase/
│   │   │   ├── admin.ts              # Service role client (bypasses RLS)
│   │   │   ├── client.ts             # Browser client (direct storage uploads)
│   │   │   └── server.ts             # SSR client (cookie-based auth)
│   │   ├── types/
│   │   │   ├── database.ts           # Manual TypeScript types for DB schema
│   │   │   └── csv-import.ts         # CSV import type definitions
│   │   ├── utils/
│   │   │   ├── achievements.ts       # Badge/achievement evaluation logic
│   │   │   ├── achievements-cron.ts  # Cron-triggered achievement processing
│   │   │   ├── imageCompression.ts   # Client-side image optimization
│   │   │   ├── mentions.ts           # @mention parsing
│   │   │   ├── rateLimit.ts          # Database-backed rate limiter
│   │   │   ├── storage.ts            # Signed URL helpers
│   │   │   ├── uuid.ts              # UUID generation utilities
│   │   │   └── validation.ts         # Input validation helpers
│   │   ├── context/
│   │   │   └── SimpleModeContext.tsx  # Accessibility: 130% fonts, 60px buttons
│   │   ├── auth.ts                   # requireAuth() helper
│   │   ├── email.ts                  # Resend email sending
│   │   ├── logger.ts                 # Structured logging
│   │   └── safety.ts                 # Content safety checks
│   │
│   ├── proxy.ts                      # Request proxy for Next.js compatibility
│   │
│   └── __tests__/                    # Unit + integration test files
│       └── mocks/
│           └── supabase.ts           # Supabase mock factory for tests
│
├── .env.local                        # Environment variables (GITIGNORED)
├── .gitignore                        # Git ignore rules
├── package.json                      # Dependencies and scripts
├── tsconfig.json                     # TypeScript configuration (strict mode)
├── next.config.ts                    # Next.js configuration
├── vitest.config.ts                  # Vitest test runner config
├── playwright.config.ts              # Playwright E2E config
├── eslint.config.mjs                 # ESLint rules (Next.js + security plugin)
├── vercel.json                       # Vercel deployment config (cron schedule)
└── CONTRIBUTING.md                   # Code style and contribution guide
```

## Key Concepts

### Server Actions as the Backend

There is **no separate API layer**. All backend logic lives in 36 `"use server"` files under `src/app/actions/`. Next.js handles serialization between client and server. Client components import server actions directly.

### Three Supabase Clients

| Client | File | Usage |
|--------|------|-------|
| **Server** | `lib/supabase/server.ts` | SSR pages — reads cookies for auth |
| **Client** | `lib/supabase/client.ts` | Browser — direct storage uploads |
| **Admin** | `lib/supabase/admin.ts` | Service role — bypasses RLS for cross-user writes |

### CSS Architecture

| File | Purpose |
|------|---------|
| `globals.css` | Design tokens (`:root`), shared primitives (`.btn-*`, `.card`, `.form-*`, `.modal-*`) |
| `studio.css` | Art Studio feature styles |
| `competition.css` | Competition/show feature styles |
| `reference.css` | Catalog curation feature styles (V32) |
| `*.module.css` | 19 component-scoped CSS Modules |

**Convention:** New components should use CSS Modules. Shared primitives stay in globals.

---

**Next:** [Setup](setup.md) · [Architecture Overview](../architecture/overview.md)
