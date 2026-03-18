# Model Horse Hub — Complete Project Report

> **Report Date:** March 18, 2026  
> **Repository:** `smount92/ProjectEquiscape` (GitHub, private)  
> **Total Commits:** 267 (first commit: March 14, 2026 — repo migrated from prior local development starting ~March 6)  
> **Status:** Closed beta with active testers

---

## 1. Executive Summary

**Model Horse Hub** is a privacy-first digital stable, social platform, and marketplace purpose-built for the model horse collecting hobby. It serves as a comprehensive tool for cataloging, insuring, showing, trading, commissioning art, and socializing around model horses (Breyer, Stone, artist resins, etc.).

The platform was built from scratch in ~12 days using AI-assisted pair programming. Despite the rapid pace, the architecture follows enterprise-grade patterns: event-sourced provenance, a unified polymorphic catalog, formal commerce state machine, a gamification achievement engine, and comprehensive Row Level Security across every table. Full JSDoc documentation and a comprehensive `/docs` folder were added as part of a formal documentation sprint.

### Key Metrics

| Metric | Value |
|--------|-------|
| **TypeScript/TSX source lines** | 35,703 |
| **CSS lines** | 12,411 (globals: 4,673 + 49 CSS files) |
| **Total source size** | 2.11 MB |
| **Page routes** | 53 |
| **Client components** | 98 (+14 CSS Modules) |
| **Server action files** | 35 |
| **Database migrations** | 86 (001–090) |
| **SQL migration lines** | 6,532 |
| **Unit/component tests** | 194 (across 20 test files) |
| **CI pipeline** | GitHub Actions (build + test on every push) |
| **Documentation pages** | 31 (in `/docs/`) |
| **Workflow documents** | 57 |
| **Strategic docs** | 16 |

---

## 2. Technology Stack

| Layer | Technology | Version | Notes |
|-------|-----------|---------|-------|
| **Framework** | Next.js (App Router) | 16.1.6 | Turbopack for dev/build |
| **Runtime** | React | 19.2.3 | Server Components + Client Components |
| **Language** | TypeScript | 5.x | Strict mode, manual DB types |
| **Database** | Supabase (PostgreSQL) | — | RLS on every table, materialized views |
| **Auth** | Supabase Auth | — | PKCE flow, cookie-based SSR, `requireAuth()` helper |
| **Hosting** | Vercel | Serverless | Hobby tier |
| **CSS** | Vanilla CSS | — | Design tokens + 49 CSS files (19 Modules + 30 extracted globals) |
| **Testing** | Vitest + Playwright | 4.x / 1.58 | Unit + component (RTL) + E2E scaffolding |
| **Email** | Resend | 6.9.3 | Transactional notifications |
| **PDF** | @react-pdf/renderer | 4.3.2 | Insurance reports, CoA exports |
| **Search** | fuzzysort | 3.1.0 | Client-side fuzzy matching |
| **CSV** | PapaParse | 5.5.3 | Batch import |
| **QR Codes** | qrcode.react | 4.2.0 | Passport/transfer QR codes |
| **Markdown** | react-markdown + remark-gfm | 10.1.0 | Rich text rendering |
| **Icons** | lucide-react | 0.577.0 | UI icons throughout |
| **Sanitization** | sanitize-html | 2.17.1 | XSS-safe HTML rendering |

### Why These Choices

- **Next.js App Router** — Server Components reduce client JS bundle; server actions eliminate the need for a separate API layer. The entire backend is co-located with the frontend.
- **Supabase** — PostgreSQL with RLS provides row-level security without application middleware. Signed URLs for private storage. Real-time subscriptions for future features.
- **Vanilla CSS** — The design system predates component-scoped styling. A `globals.css` monolith was refactored in the March 2026 CSS Modularization Sprint: 30 page-specific blocks were extracted into co-located `.css` files, reducing `globals.css` from 11,701 to 4,673 lines (60% reduction). 19 CSS Modules provide scoped styles for newer components. Shared primitives (buttons, cards, forms, modals) remain global.
- **No ORM** — Direct Supabase client calls with PostgREST joins. Manual TypeScript types mirror the schema. This avoids ORM abstraction leaks and keeps queries transparent.
- **Vitest** — Lightweight, fast unit testing with good TypeScript support. 194 tests cover critical server action logic, utility functions, and 5 UI components via React Testing Library. GitHub Actions CI runs all tests on every push.

---

## 3. Architecture Overview

### 3.1 Project Structure

```
model-horse-hub/
├── .agents/
│   ├── workflows/           # 57 workflow documents (.md)
│   └── docs/                # 16 strategic/planning documents
├── docs/                    # 31 documentation pages (architecture, guides, API, database)
│   ├── architecture/        # ADRs, data-flow diagrams, system overview
│   ├── api/                 # API route documentation
│   ├── components/          # Component catalog
│   ├── database/            # Schema overview, migrations log, RLS policies
│   ├── getting-started/     # Setup, project structure
│   ├── guides/              # Adding features, migrations
│   └── routes/              # Page route documentation
├── scripts/                 # 7 data scraping/seeding scripts
├── supabase/
│   └── migrations/          # 86 SQL migration files (001–090)
├── src/
│   ├── app/
│   │   ├── layout.tsx       # Root layout (Inter font, GA, SimpleModeProvider, Header)
│   │   ├── globals.css      # ~4,673 lines — design tokens + shared styles
│   │   ├── studio.css       # Art Studio styles
│   │   ├── competition.css  # Competition/show styles
│   │   ├── [12 extracted .css] # Page-specific blocks extracted from globals
│   │   ├── actions/         # 35 server action files (ALL backend logic)
│   │   │   └── __tests__/   # 15 test files, 136 server action tests
│   │   ├── api/             # 11 API routes
│   │   └── [53 route dirs]  # Page routes
│   ├── components/          # 98 client components + 19 CSS Modules + 16 extracted .css
│   │   ├── __tests__/       # 5 component test files, 58 RTL tests
│   │   └── pdf/             # PDF generation components
│   └── lib/
│       ├── supabase/        # admin.ts, client.ts, server.ts
│       ├── types/           # database.ts (manual types), csv-import.ts
│       ├── utils/           # achievements, imageCompression, mentions, rateLimit, storage, validation
│       ├── context/         # SimpleModeContext (accessibility)
│       ├── constants/       # Shared constants
│       └── auth.ts          # requireAuth() helper
├── e2e/                     # Playwright E2E test scaffolding
└── public/                  # Static assets, fonts
```

### 3.2 Data Flow Architecture

```mermaid
graph TD
    A["Browser (React 19)"] -->|Server Action calls| B["Next.js Server Actions"]
    B -->|requireAuth + createClient SSR| C["Supabase PostgreSQL"]
    A -->|Direct upload| D["Supabase Storage"]
    B -->|getAdminClient| E["Supabase Admin (bypasses RLS)"]
    B -->|after()| F["Background Tasks"]
    F -->|Notifications, Activity Events, Achievements| C
    G["Vercel Cron"] -->|Daily 6 AM UTC| H["/api/cron/refresh-market"]
    H -->|Refresh materialized view| C
    A -->|Public URLs| D
```

**Key pattern:** Pages are Server Components that fetch data directly. Client Components call server actions (imported directly — Next.js handles serialization). The `after()` API from Next.js wraps deferred tasks (notifications, activity events, achievement evaluation) so they don't block the response — critical for serverless cold start budget.

### 3.3 Authentication Flow

1. User signs up via `/signup` → Supabase Auth creates account
2. Email confirmation via Supabase's built-in flow
3. Auth callback at `/api/auth/callback` handles PKCE code exchange
4. Cookie-based SSR session — `createClient()` from `@/lib/supabase/server` reads cookies
5. Client-side: `createClient()` from `@/lib/supabase/client` for direct storage uploads
6. Password reset: `/forgot-password` → `/auth/callback` (PKCE) → `/settings` (reset form)
7. Server actions use `requireAuth()` helper — a centralized auth gate that returns `{ supabase, user }` or throws

### 3.4 Security Layers

| Layer | Implementation |
|-------|---------------|
| **Row Level Security** | Every table has RLS policies. Users can only read/write their own data. |
| **Auth helper** | `requireAuth()` centralizes auth checks across all 35 server action files |
| **Admin bypass** | `getAdminClient()` uses `SUPABASE_SERVICE_ROLE_KEY` for cross-user writes (notifications, transfers) |
| **Rate limiting** | `checkRateLimit()` utility — configurable per-action limits |
| **Chat guardrails** | `RISKY_PAYMENT_REGEX` warns when users mention off-platform payment methods |
| **Tombstone deletion** | Soft delete preserves data integrity for provenance chains |
| **Crypto PINs** | `crypto.randomInt()` for transfer claim PINs (not `Math.random()`) |
| **Watermarking** | Opt-in image watermarking at upload time (username overlay) |
| **Block system** | Blocked users cannot interact — filtered at query level |
| **Immutable storage** | Horse image paths include `horse_id` prefix — no cross-user access |
| **HTML sanitization** | `sanitize-html` prevents XSS in user-generated content |

---

## 4. Database Schema

### 4.1 Schema Evolution

The database went through a **Grand Unification** (documented in `Grand_Unification_Plan.md`) across phases V6–V11 that consolidated legacy tables into universal, polymorphic structures:

| Phase | Migration | What Changed |
|-------|-----------|-------------|
| V6 | 042 | **Universal Social Engine** — Single `posts` table + `media_attachments` + `likes` replaced 6 legacy tables |
| V7 | 044 | **Universal Trust Engine** — `transactions` + `reviews` replaced ad-hoc DM trading |
| V8 | 046 | **Unified Competition Engine** — `events` + `event_entries` + `event_divisions` + `event_classes` merged photo shows |
| V9 | 048 | **Universal Catalog** — `catalog_items` polymorphic table replaced `reference_molds` + `reference_releases` + `artist_resins` |
| V10 | 050 | **Universal Ledger** — `v_horse_hoofprint` materialized view (UNION ALL across 5 source tables) replaced physical timeline table |
| V11 | 052 | **The Great Purge** — Dropped all legacy tables |

### 4.2 Core Tables

| Table | Purpose |
|-------|---------|
| `users` | User profiles, settings, avatar, bio, currency preference |
| `user_horses` | The central inventory record — custom name, finish, condition, visibility, trade status |
| `horse_images` | Photo metadata with `angle_profile` enum (12 values including extra_detail) |
| `financial_vault` | Purchase price, estimated value, insurance notes (STRICTLY PRIVATE) |
| `catalog_items` | Polymorphic reference catalog — molds, releases, resins, tack (10,500+ entries) |
| `user_collections` | Personal folders/collections |
| `horse_collections` | Junction table for multi-collection assignment (M:N) |
| `horse_transfers` | Ownership transfer records with claim PINs |
| `horse_pedigrees` | Artist resin lineage (sire, dam, sculptor, cast#) |
| `show_records` | Manually-entered show results for individual horses |
| `customization_logs` | Customization work history |
| `condition_history` | Condition grade changes over time |

### 4.3 Social & Community Tables

| Table | Purpose |
|-------|---------|
| `posts` | Universal social posts — feed posts, comments, group posts, event posts |
| `media_attachments` | Images/videos attached to posts |
| `likes` | Polymorphic likes (post or horse) |
| `user_follows` | Follow relationships |
| `activity_events` | Activity feed events (new horse, transfer, etc.) |
| `notifications` | In-app notification queue |
| `conversations` + `messages` | Direct messaging system |
| `user_blocks` | Block list |
| `user_reports` | Content/user reports for moderation |

### 4.4 Commerce & Trust Tables

| Table | Purpose |
|-------|---------|
| `transactions` | Formal offer/accept/pay/release state machine |
| `reviews` | Post-transaction ratings (1–5 stars + text) |
| `user_wishlists` | Wishlist with catalog item links |
| `horse_favorites` | Favorited horses |

### 4.5 Competition & Events Tables

| Table | Purpose |
|-------|---------|
| `events` | Shows, meetups, swaps — all event types |
| `event_entries` | Horse entries in events/shows |
| `event_divisions` | Division hierarchy for structured shows |
| `event_classes` | Classes within divisions (NAMHSA-style) |
| `event_judges` | Assigned expert judges |
| `event_rsvps` | Going/interested/not going |
| `event_comments` | Discussion on events |
| `event_photos` | Photo gallery per event |

### 4.6 Art Studio Tables

| Table | Purpose |
|-------|---------|
| `artist_profiles` | Artist public profiles and portfolios |
| `commission_listings` | Posted commission offerings |
| `commissions` | Active commission orders with shipping status |
| `commission_updates` | WIP progress updates with photos |

### 4.7 Groups & Collaboration

| Table | Purpose |
|-------|---------|
| `groups` | Community groups (clubs, regional groups) |
| `group_members` | Membership with roles (admin/moderator/member) |
| `group_files` | Shared documents within groups |

### 4.8 Gamification Tables

| Table | Purpose |
|-------|---------|
| `badges` | Achievement definitions (name, criteria, icon, tier) |
| `user_badges` | Awarded badges per user with timestamps |

### 4.9 Materialized Views

| View | Purpose | Refresh |
|------|---------|---------| 
| `v_horse_hoofprint` | Universal provenance ledger — UNION ALL across transfers, condition changes, show records, customization logs, pedigrees | On demand |
| `mv_market_prices` | Blue Book price guide — aggregated from completed transactions by catalog item, finish type, life stage | Vercel cron daily at 6 AM UTC |
| `discover_users_view` | Active collectors with horse counts and rating averages | — |

### 4.10 Key Design Decisions

1. **Polymorphic `catalog_items`** — A single table with an `item_type` column (`plastic_mold`, `plastic_release`, `artist_resin`, `tack`, etc.) and a `parent_id` FK for hierarchy (release → mold). This eliminated 3 separate reference tables and future-proofs for any collectible type.

2. **Event-sourced provenance** — Instead of a mutable timeline, horse provenance is a materialized view that unions across immutable source tables. Each source of truth (transfers, condition changes, show records) maintains its own data; the view assembles the timeline without data duplication.

3. **Commerce state machine** — Transaction status follows a strict flow: `offer_made → pending_payment → funds_verified → completed` (with `cancelled` escape hatch at any step). This prevents rug-pulls and ensures both parties have clear state visibility.

4. **Junction table for collections** — Horses can belong to multiple collections (e.g., "Show String" and "Childhood Herd" simultaneously) via the `horse_collections` junction table. A legacy `collection_id` FK on `user_horses` is maintained for backward compatibility.

5. **Angle profile enum** — Horse photos use a strict PostgreSQL enum (`angle_profile`) with 12 values: `Primary_Thumbnail`, `Left_Side`, `Right_Side`, `Front_Chest`, `Back_Hind`, `Belly_Makers_Mark`, `Detail_Face_Eyes`, `Detail_Ears`, `Detail_Hooves`, `Flaw_Rub_Damage`, `extra_detail`, and `Other`. This enables structured multi-angle galleries.

---

## 5. Feature Inventory

### 5.1 Inventory & Cataloging

| Feature | Status | Entry Point |
|---------|--------|-------------|
| Multi-step Add Horse form | ✅ Complete | `/add-horse` |
| Edit Horse (all fields) | ✅ Complete | `/stable/[id]/edit` |
| Delete Horse (tombstone) | ✅ Complete | Delete modal |
| 5 LSQ Photo Slots | ✅ Complete | Near-Side, Off-Side, Front, Hind, Belly/Mark |
| Extra Detail Photos (10 max) | ✅ Complete | Dropzone in add/edit forms |
| Image Crop Tool | ✅ Complete | Aspect ratio presets, rule-of-thirds grid |
| Photo Lightbox | ✅ Complete | Portal-based fullscreen viewer with keyboard nav |
| Opt-in Watermarking | ✅ Complete | Settings toggle |
| Unified Reference Search | ✅ Complete | Fuzzy search across 10,500+ catalog items |
| Suggest Missing Reference | ✅ Complete | Modal with type selection |
| Batch CSV Import | ✅ Complete | `/stable/import` |
| Personal Collections (M:N) | ✅ Complete | Checkbox multi-select |
| Financial Vault (private) | ✅ Complete | Purchase price, value, insurance |
| Fuzzy Purchase Dates | ✅ Complete | Text field alongside date picker |
| Currency Preference | ✅ Complete | Per-user symbol ($/€/£) |
| Asset Categories | ✅ Complete | Model, Tack, Prop, Diorama |
| Life Stage Tracking | ✅ Complete | Living, Deceased, Stripped, Unknown |

### 5.2 Provenance & Identity

| Feature | Status | Entry Point |
|---------|--------|-------------|
| Hoofprint™ Timeline | ✅ Complete | `/stable/[id]` |
| Ownership Transfers | ✅ Complete | Transfer modal + claim PIN |
| Condition History Ledger | ✅ Complete | Auto-tracked on grade change |
| Show Records | ✅ Complete | Manual entry + auto-generation from events |
| Pedigree Card | ✅ Complete | Sire/dam/sculptor/cast lineage |
| Customization Logs | ✅ Complete | Artist, work type, materials, dates |
| Parked Export (CoA) | ✅ Complete | PDF + QR code + data bundle |
| Insurance Report (PDF) | ✅ Complete | Branded PDF with horse data |
| Help Me ID | ✅ Complete | Community-assisted identification |

### 5.3 Social & Community

| Feature | Status | Entry Point |
|---------|--------|-------------|
| Activity Feed | ✅ Complete | `/feed` with infinite scroll |
| Posts (text + images) | ✅ Complete | Feed, group, event contexts |
| Threaded Comments | ✅ Complete | Reply chains |
| @Mentions | ✅ Complete | Supports spaces in names |
| Likes | ✅ Complete | Posts and horses |
| Follow System | ✅ Complete | User-to-user follows |
| Notifications | ✅ Complete | Bell icon with unread count |
| Direct Messaging | ✅ Complete | `/inbox` with chat threads |
| Block System | ✅ Complete | Prevents all interaction |
| User Profiles | ✅ Complete | `/profile/[alias]` |
| Discover Collectors | ✅ Complete | `/discover` with search |
| Community Show Ring | ✅ Complete | Public horse browsing with filters |

### 5.4 Commerce & Trading

| Feature | Status | Entry Point |
|---------|--------|-------------|
| Marketplace Status | ✅ Complete | For Sale / Open to Offers / Not for Sale / Stolen/Missing |
| Make Offer System | ✅ Complete | Formal offer → accept/decline flow |
| Commerce State Machine | ✅ Complete | 4-step transaction lifecycle |
| Transaction Ratings | ✅ Complete | 1–5 stars + review text |
| Rating Badges | ✅ Complete | Displayed on profiles |
| Message Seller | ✅ Complete | DM with horse context card |
| Market Price Guide | ✅ Complete | `/market` (The Blue Book) |
| Wishlist | ✅ Complete | `/wishlist` with catalog search |
| Matchmaker | ✅ Complete | Wishlist ↔ For Sale matching |

### 5.5 Competition & Shows

| Feature | Status | Entry Point |
|---------|--------|-------------|
| Photo Shows (community vote) | ✅ Complete | `/shows` |
| Expert-Judged Shows | ✅ Complete | Judge assignment + placing panel |
| Division → Class Hierarchy | ✅ Complete | NAMHSA-style structured shows |
| Event Management | ✅ Complete | `/community/events/[id]/manage` |
| Show Entry Form | ✅ Complete | Class-linked entries |
| Show String Manager | ✅ Complete | `/shows/planner` |
| NAN Tracker | ✅ Complete | NAN-qualifying class marking |
| Show Records (auto-gen) | ✅ Complete | Expert placings → horse records |
| Event Comments/Photos/RSVP | ✅ Complete | Full event enrichment |
| Copy Division Tree | ✅ Complete | Reuse class structures |

### 5.6 Art Studio

| Feature | Status | Entry Point |
|---------|--------|-------------|
| Artist Profiles | ✅ Complete | `/studio/[slug]` |
| Commission Listings | ✅ Complete | Service catalog |
| Commission Requests | ✅ Complete | Request form with horse linking |
| WIP Portal | ✅ Complete | Progress updates + photo timeline |
| Shipping Status | ✅ Complete | Commission status includes shipping step |
| Artist Browser | ✅ Complete | `/studio` |

### 5.7 Groups

| Feature | Status | Entry Point |
|---------|--------|-------------|
| Group Creation | ✅ Complete | `/community/groups/create` |
| Group Posting | ✅ Complete | Group feed |
| Admin Panel | ✅ Complete | Moderation, member management |
| Group Files | ✅ Complete | Shared document uploads |
| Group Registry | ✅ Complete | Collection registries within groups |
| Sub-Channels | ✅ Complete | Categorized discussions |

### 5.8 Gamification

| Feature | Status | Entry Point |
|---------|--------|-------------|
| Achievement System | ✅ Complete | Badge definitions + criteria engine |
| Trophy Case | ✅ Complete | User profile display |
| Async Evaluation | ✅ Complete | `after()` hook evaluates on triggers |
| Cron Evaluation | ✅ Complete | Complex badges via scheduled job |

### 5.9 Platform & Infrastructure

| Feature | Status | Entry Point |
|---------|--------|-------------|
| Simple Mode (accessibility) | ✅ Complete | Settings toggle — 130% fonts, 60px buttons |
| Featured Horses | ✅ Complete | Admin-curated spotlight |
| Admin Dashboard | ✅ Complete | `/admin` |
| Admin Suggestions Panel | ✅ Complete | Reference catalog suggestions |
| SEO (robots.txt, sitemap) | ✅ Complete | Automated generation |
| Contact Form | ✅ Complete | `/contact` |
| Cookie Consent | ✅ Complete | GDPR banner |
| Back-to-Top Button | ✅ Complete | Scroll utility |
| Dashboard Toast System | ✅ Complete | Timed notification toasts (updated, deleted, photos_updated, photo_error) |
| Error/Not Found Pages | ✅ Complete | Branded error states |
| Private Analytics Widget | ✅ Complete | Stable overview on dashboard |
| Share Button | ✅ Complete | Web Share API + clipboard fallback |

---

## 6. Design System

### 6.1 Theme — "Warm Equestrian Parchment"

The visual identity evokes leather-bound catalogs and vintage horse shows:

| Token | Light Mode | Simple Mode Override |
|-------|-----------|---------------------|
| Background | `#F0EAD6` (warm parchment) | `#FFFFFF` (pure white) |
| Card BG | `#FBF7ED` (cream) | `#FFFFFF` |
| Text Primary | `#2D2318` (espresso) | `#111111` (near-black) |
| Text Muted | `#8B7B6A` (warm slate) | `#555555` |
| Accent Primary | `#2C5545` (hunter green) | `#2C5545` |
| Accent Secondary | `#8B5A2B` (saddle brown) | — |
| Danger | `#9B3028` (barn red) | — |
| Warning | `#B8860B` (dark goldenrod) | — |
| Border | `#D4C9B5` (warm almond) | `#CCCCCC` |

### 6.2 Typography

- **Font:** Inter (Google Fonts) — loaded via `@import`
- **Base size:** 16px (`1rem`)
- **Scale:** xs (12px) → 3xl (40px)
- **Simple Mode:** 130% multiplier via `--font-scale: 1.3`

### 6.3 CSS Architecture

The CSS layer evolved through several phases:

1. **V1–V15:** Everything in `globals.css` (grew to ~12,000 lines)
2. **V20 (CSS Maturity Sprint):** Extracted 19 CSS Modules, reducing globals by 28%
3. **Current state:** `globals.css` (~11,700 lines) contains design tokens + shared primitives. Component-specific styles live in co-located CSS Modules.

**CSS Modules in use (19):** ChatThread, OfferCard, MakeOfferModal, DashboardShell, DashboardToast, StableLedger, GroupDetailClient, GroupAdminPanel, GroupFiles, FeaturedHorseCard, MatchmakerMatches, FavoriteButton, WishlistButton, RatingForm, discover, inbox, settings, page.module.css

**Convention:** New components should use CSS Modules. Shared primitives (`.btn-*`, `.card`, `.form-*`, `.modal-*`, `.horse-card-*`, `.feed-*`) remain in globals.

### 6.4 Responsive Design

- Mobile-first with breakpoints at 600px, 768px, 1024px, 1200px, 1440px
- Header uses Priority+ pattern with `ResizeObserver` — items collapse into hamburger menu
- Dashboard uses two-column layout on desktop, single column on mobile
- Horse cards in responsive grid: `repeat(auto-fill, minmax(280px, 1fr))`
- Forms use multi-step wizard pattern with step cards
- Desktop polish sprint (V18) addressed widescreen gutters and grid scaling at 1440px

---

## 7. Server Actions — The Backend

All backend logic lives in 35 `"use server"` action files under `src/app/actions/`. There is no separate API layer — Next.js server actions ARE the API.

### 7.1 Action Files by Domain

| File | Size | Purpose |
|------|------|---------|
| `horse.ts` | 27KB | Core CRUD — create, update, delete, finalize images, bulk ops |
| `competition.ts` | 32KB | Event divisions, classes, entries, placings |
| `transactions.ts` | 34KB | Commerce state machine — offers, payments, completion |
| `art-studio.ts` | 32KB | Artist profiles, commissions, WIP updates, shipping |
| `groups.ts` | 32KB | Group CRUD, membership, files, sub-channels |
| `events.ts` | 29KB | Event CRUD, RSVP, judges, comments, photos |
| `shows.ts` | 25KB | Photo shows, voting, show records |
| `parked-export.ts` | 19KB | CoA PDF data assembly |
| `hoofprint.ts` | 18KB | Provenance timeline, transfers, life stage |
| `posts.ts` | 17KB | Social posts, comments, media |
| `activity.ts` | 13KB | Feed generation, activity events |
| `help-id.ts` | 11KB | Community identification requests |
| `messaging.ts` | 10KB | DM conversations, messages |
| `settings.ts` | 10KB | User preferences, profile, password |
| `provenance.ts` | 9KB | Hoofprint timeline queries |
| `market.ts` | 8KB | Blue Book price queries |
| `insurance-report.ts` | 6KB | Insurance PDF data |
| `admin.ts` | 7KB | Admin dashboard, suggestions |
| `collections.ts` | 5KB | Multi-collection management |
| `moderation.ts` | 5KB | Reports, admin actions |
| `notifications.ts` | 5KB | Notification queue management |
| `follows.ts` | 4KB | Follow/unfollow |
| `reference.ts` | 4KB | Catalog item queries |
| `suggestions.ts` | 4KB | Reference catalog suggestions |
| `horse-events.ts` | 3KB | Activity event emission for horses |
| `csv-import.ts` | 3KB | Batch import RPC |
| `blocks.ts` | 3KB | Block/unblock |
| `contact.ts` | 2KB | Contact form submission |
| `likes.ts` | 2KB | Like/unlike toggle |
| `wishlist.ts` | 2KB | Wishlist management |
| `social.ts` | 2KB | Legacy social helpers |
| `mentions.ts` | 2KB | @mention parsing and notification |
| `ratings.ts` | 2KB | Transaction review queries |
| `header.ts` | 2KB | Header data (unread counts) |
| `profile.ts` | 1KB | Public profile query |

### 7.2 Patterns Used

```typescript
// Centralized auth gate (migrated from boilerplate in V33)
const { supabase, user } = await requireAuth();

// Standard return type
{ success: boolean; error?: string; data?: T }

// Admin client for cross-user writes
const admin = getAdminClient();

// Background task (serverless-safe)
after(async () => {
  // notifications, activity events, achievement evaluation
});

// Cache invalidation
revalidatePath("/dashboard");
```

### 7.3 Test Coverage

194 tests across 20 test files covering server actions, utilities, and UI components:

#### Server Action Tests (136 tests, 15 files)

| Suite | Tests | Coverage |
|-------|-------|----------|
| `collections.test.ts` | Collection CRUD, M:N junction ops | 30+ |
| `horse.test.ts` | Create, delete, quick-add, finalize images | 12 |
| `provenance.test.ts` | Show records, pedigree, timeline queries | 30+ |
| `transactions.test.ts` | Commerce state machine, offers, payments, cancellations | 40+ |

#### Component Tests — React Testing Library (58 tests, 5 files)

| Component | Tests | Coverage Highlights |
|-----------|-------|-------------------|
| `PhotoLightbox.test.tsx` | 15 | Keyboard nav, portal rendering, body scroll lock, wrap-around |
| `TrophyCase.test.tsx` | 9 | Empty state, category grouping, sort order, tier classes |
| `MarketFilters.test.tsx` | 10 | Filter controls, URL param updates, dropdowns, accessibility IDs |
| `MakeOfferModal.test.tsx` | 11 | Form validation, payment safety warnings, offer submission |
| `HoofprintTimeline.test.tsx` | 13 | Timeline events, ownership chain, add note form, stage selector |

Setup: `src/components/__tests__/setup.ts` provides shared mocks for Next.js navigation, Supabase clients, and `@testing-library/jest-dom` matchers. Tests use `// @vitest-environment jsdom` and `userEvent` for interaction simulation.

#### CI Pipeline

GitHub Actions (`.github/workflows/ci.yml`) runs on every push to `main` or `quality-sprint-*` branches:
1. Install dependencies (`npm ci`)
2. Lint (advisory)
3. Build (`npm run build`)
4. All tests (`npx vitest run`)
5. Upload test artifacts (14-day retention)

---

## 8. API Routes

Eleven API routes handle concerns that can't be server actions:

| Route | Purpose |
|-------|---------|
| `/api/auth/callback` | Supabase PKCE code exchange + session setup |
| `/api/cron/refresh-market` | Daily materialized view refresh (Vercel cron) |
| `/api/export/[horseId]` | CoA/parked export PDF generation |
| `/api/identify-mold` | AI-powered mold identification (image analysis) |
| `/api/reference-dictionary` | Reference data dictionary for search |

---

## 9. Client Components

98 client components power the interactive UI. Major categories:

### 9.1 Core UI Components

| Component | Size | Purpose |
|-----------|------|---------|
| `Header.tsx` | 23KB | Priority+ nav with ResizeObserver |
| `DashboardShell.tsx` | 11KB | Two-column layout, search, view toggles |
| `StableGrid.tsx` | 11KB | Horse card grid with sorting/filtering |
| `UnifiedReferenceSearch.tsx` | 14KB | Fuzzy catalog search with preview |
| `UniversalFeed.tsx` | 21KB | Activity feed with infinite scroll |
| `ShowRingGrid.tsx` | 14KB | Public horse browsing |
| `ShowStringManager.tsx` | 30KB | Show string planning + entry management |
| `CsvImport.tsx` | 30KB | Multi-step batch import wizard |
| `ImageCropModal.tsx` | 19KB | Interactive image cropping |
| `PedigreeCard.tsx` | 20KB | Resin lineage display |
| `CommissionTimeline.tsx` | 23KB | Commission progress + shipping workflow |

### 9.2 Commerce Components

| Component | Purpose |
|-----------|---------|
| `MakeOfferModal.tsx` | Formal offer submission |
| `OfferCard.tsx` | Offer display + accept/decline/counter |
| `TransferModal.tsx` | Ownership transfer initiation |
| `TransactionActions.tsx` | State machine action buttons |
| `MessageSellerButton.tsx` | DM with horse context |
| `MarketValueBadge.tsx` | Blue Book price badge |
| `MarketFilters.tsx` | Market page search/filter |

### 9.3 Social Components

| Component | Purpose |
|-----------|---------|
| `ChatThread.tsx` | DM thread with offer cards |
| `NotificationBell.tsx` | Header notification icon |
| `NotificationList.tsx` | Notification feed |
| `FollowButton.tsx` | Follow/unfollow toggle |
| `LikeToggle.tsx` | Like/unlike animation |
| `ShareButton.tsx` | Web Share API + clipboard fallback |
| `RichText.tsx` | Markdown rendering for social posts |
| `RichEmbed.tsx` | URL preview embeds |
| `ReportButton.tsx` | Content/user flagging |
| `BlockButton.tsx` | Block toggle |

### 9.4 Provenance Components

| Component | Purpose |
|-----------|---------|
| `HoofprintTimeline.tsx` | Visual provenance timeline |
| `PedigreeCard.tsx` | Resin lineage display |
| `ShowRecordTimeline.tsx` | Show history |
| `ShowRecordForm.tsx` | Manual show record entry |
| `TransferHistorySection.tsx` | Transfer chain display |
| `ParkedExportPanel.tsx` | CoA/export controls |
| `InsuranceReportButton.tsx` | Insurance PDF trigger |
| `PhotoLightbox.tsx` | Portal-based fullscreen photo viewer |
| `PassportGallery.tsx` | Multi-angle passport photo display |

### 9.5 Gamification Components

| Component | Purpose |
|-----------|---------|
| `TrophyCase.tsx` | User badge display grid |
| `NanDashboardWidget.tsx` | NAN tracking widget |

---

## 10. Data Seeding & Reference Catalog

### 10.1 Scripts

| Script | Purpose |
|--------|---------|
| `scrape_breyer_molds.mjs` | Scrapes Breyer mold data from external sources |
| `scrape_releases.mjs` | Scrapes Breyer release data |
| `scrape_missing_releases.mjs` | Fills gaps in release data |
| `scrape_erd.mjs` | Scrapes Equine Resin Directory (artist resins, ~5000 IDs) |
| `seed_batch2.mjs` | Seeds scraped mold data into catalog_items |
| `seed_releases.mjs` | Seeds release data |
| `seed_erd_resins.mjs` | Seeds ERD resin data into artist_resins → catalog_items |

### 10.2 Catalog Content

The `catalog_items` table contains **10,500+ entries** organized hierarchically:

- **Molds** (`plastic_mold`) — e.g., "Alborozo", "Stablemate Arabian"
- **Releases** (`plastic_release`) — e.g., "Bay Roan Alborozo" (parent_id → mold)
- **Artist Resins** (`artist_resin`) — e.g., "Argyle" by Sarah Rose
- **Tack** (`tack`) — saddles, bridles, etc.

The polymorphic `item_type` column + `parent_id` FK enables arbitrary hierarchy without schema changes.

---

## 11. Documentation

### 11.1 Documentation Structure

The `/docs/` directory contains 31 pages organized into 7 sections:

| Section | Contents |
|---------|----------|
| `getting-started/` | Setup guide, project structure reference |
| `architecture/` | System overview, data flow diagrams, ADRs (6 decisions documented) |
| `database/` | Schema overview, migrations log, RLS policy catalog |
| `api/` | API route documentation |
| `components/` | Component catalog with props |
| `routes/` | Page route documentation |
| `guides/` | How to add features, write migrations |

### 11.2 JSDoc Coverage

All 35 server action files have JSDoc comments on exported functions, documenting parameters, return types, and behavior. Coverage was achieved through a formal documentation sprint (Phase 5 of the documentation plan).

### 11.3 Workflow Documents

57 workflow files in `.agents/workflows/` document every sprint, from the initial mobile polish through the latest commission refinements. Each workflow follows a standard format with `// turbo-all` annotations for automated execution.

---

## 12. Development History

### 12.1 Phase Timeline

| Phase | Sprint | Key Deliverables |
|-------|--------|-----------------|
| **V1** | Initial Build | Core schema, auth, CRUD, Add/Edit/Delete horse, dashboard, Show Ring |
| **V2** | Enterprise Refactor | Atomic RPCs, direct-to-storage uploads, N+1 elimination |
| **V3** | CRUD Completion | Parked export, admin suggestions, edit direct-to-storage |
| **V4** | Final Cleanup | N+1 alias map eradication, dead code removal |
| **V5** | Modern Social | Likes, @mentions, threaded comments, real-time DMs, image posts, infinite scroll, blocks |
| **V6** | Universal Social Engine | Single `posts` table, `media_attachments`, unified `likes` |
| **V7** | Universal Trust Engine | `transactions` + `reviews` state machine |
| **V8** | Unified Competition | Merged photo shows into universal `events` |
| **V9** | Universal Catalog | Polymorphic `catalog_items` (10,500+ entries) |
| **V10** | Universal Ledger | `v_horse_hoofprint` materialized view |
| **V11** | The Great Purge | Dropped all legacy tables |
| **V12** | Asset Expansion | Tack, props, dioramas in inventory |
| **V13** | Live Show Tree | Division → Class hierarchy |
| **V14** | Market Price Guide | Blue Book materialized view |
| **V15** | Post-Epic Cleanup | Navigation, auto-refresh, polish |
| **V16** | Integrity Sprint | Build fixes, SEO, type gen, cron limits |
| **V17** | Hobby-Native UX | Binder view, bulk ops, visibility, photo reorder, rich embeds |
| **V18** | Pro Dashboard | Two-column layout, sidebar, widescreen expansion |
| **V19** | Group Enrichment | Files, admin panel, sub-channels |
| **V20** | CSS Maturity | 19 CSS Modules extracted (28% globals reduction) |
| **V21** | Feed Quality | Watermarking, no-photo-no-feed rules, `after()` audit |
| **V22** | Commerce Engine | Safe-Trade state machine |
| **V23** | Deep Polish | Commerce escapes, Blue Book finish split, crypto PINs |
| **V24** | Trust & Scale | Verified provenance, rug-pull lock, handler conflicts, GC |
| **V25** | Launch Readiness | WebSocket fix, Art Studio link, auto-unpark, expert shows, moderation |
| **V26** | Masterclass Sprint | 15 directives across 4 pillars |
| **V27** | QA Sprint | 13 automated test fixes |
| **V28** | Beta Feedback R1 | Show bio, ribbons, fuzzy dates, currency, reference prominence |
| **V29** | Competition Engine | Event editing, judges, class-linked entries, expert judging |
| **V30** | UI Polish | Image cropping, multi-collections, discover search, mention fixes |
| **V31** | Private Analytics | Stable overview widget, Web Share API, native sharing |
| **V32** | Desktop Polish | Header Priority+ pattern, widescreen grid scaling, gutter fixes |
| **V33** | Auth Migration | `requireAuth()` helper rollout across all server actions |
| **V34** | ERD Scraping | Equine Resin Directory data import (5000 IDs → catalog_items) |
| **V35** | Gamification Engine | Badges, Trophy Case, async achievement evaluation |
| **V36** | Commission Refinement | Shipping status, WIP photos, status transition fixes |
| **V37** | Documentation Sprint | 31 doc pages, JSDoc on all exports, architecture diagrams |
| **V38** | Photo Upload Fixes | Lightbox portal, angle_profile enum fix, upload error visibility |

### 12.2 Key Architectural Decisions Log

| Decision | Rationale |
|----------|-----------|
| **Server actions over API routes** | Co-locates backend with frontend; Next.js handles serialization. Eliminates boilerplate API layer. |
| **Manual TypeScript types** | Generated Supabase types were too permissive. Manual typing ensures compile-time safety for the specific columns we use. |
| **Vanilla CSS over Tailwind** | Full design token control. The token system predates the project; Tailwind would require mapping all tokens to utility classes. |
| **`after()` for background tasks** | Serverless functions have cold start budgets. Notifications and activity events are deferred so they don't block the user-facing response. |
| **Junction table for collections** | The original single FK (`collection_id`) limited horses to one collection. Real-world use cases demanded M:N. Legacy FK kept in sync. |
| **Materialized views** | Provenance timeline and market prices are expensive UNION ALL queries. Materialized views pre-compute results; market refreshes daily via cron. |
| **Soft delete (tombstone)** | Hard deleting horses breaks provenance chains, transfer history, and show records. Tombstone preserves FK integrity. |
| **`requireAuth()` helper** | Centralized auth gate replaced boilerplate `getUser()` checks across all 35 action files. Reduces duplication and ensures consistent error handling. |
| **`createPortal` for modals/lightboxes** | All overlay components (modals, lightboxes) render via `createPortal(…, document.body)` to avoid CSS clipping from parent `overflow: hidden` containers. |
| **Public storage bucket** | Horse images use public Supabase URLs (no signed URL overhead). Image paths include `horses/{horseId}/` prefix for organization. |

---

## 13. Testing & Quality

### 13.1 Unit Tests

136 tests across 15 test files covering critical server action logic:

- **Collections:** M:N junction CRUD, collection assignment, deletion
- **Horse CRUD:** Create, delete, quick-add, finalize images
- **Provenance:** Show records, pedigree, timeline queries
- **Commerce:** Full state machine (offer → payment → completion → rating), cancellation, retraction

All tests pass with pre-commit hooks via Husky.

### 13.2 Build Verification

Every sprint ends with `npx next build` — the Turbopack build catches type errors, import issues, and dead code. The project currently builds with **0 errors**.

### 13.3 QA Process

- **Automated:** Vitest unit tests (136 tests, pre-commit hook)
- **E2E scaffold:** Playwright configured with axe-core accessibility testing
- **Manual:** Beta testers provide feedback via structured rounds
- **Lint:** ESLint with Next.js config + security plugin
- **Type safety:** Strict TypeScript with manual database types

### 13.4 Known Limitations

| Area | Limitation | Mitigation |
|------|-----------|------------|
| **Test coverage** | Unit tests cover server actions; no component tests | Build verification + E2E scaffold + manual testing |
| **Database types** | Manual types, not auto-generated | Types are comprehensive and kept in sync with migrations |
| **CSS monolith** | `globals.css` still ~11,700 lines | 19 CSS Modules extracted (V20). New components use CSS Modules. |
| **No SSR caching** | All dynamic pages fetch on every request | Supabase RLS requires authenticated requests; static generation not viable for private data |
| **Hobby tier Vercel** | Cron limited to daily frequency | Market price refresh is daily (sufficient for hobby volumes) |

---

## 14. Deployment & Operations

### 14.1 Deployment

- **Git push to `main`** → Vercel auto-deploys
- **Supabase migrations** → Run via dashboard SQL editor
- **Environment variables** → `.env.local` (local) / Vercel dashboard (production)

### 14.2 Required Environment Variables

```
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
RESEND_API_KEY=...
```

### 14.3 Cron Jobs

| Schedule | Endpoint | Purpose |
|----------|----------|---------|
| Daily 6 AM UTC | `/api/cron/refresh-market` | Refresh `mv_market_prices` materialized view |

---

## 15. Current State & Next Steps

### 15.1 What's Complete

The platform is feature-complete for closed beta. All core inventory, social, commerce, competition, art studio, group, and gamification features are implemented and building successfully. Comprehensive documentation covers architecture, database schema, API routes, components, and developer guides.

### 15.2 Migration Status

All 86 migrations (001–090) have been deployed to production Supabase. The most recent, migration **090** (`angle_profile_extras.sql`), added the `extra_detail` and `Belly_Makers_Mark` values to the `angle_profile` PostgreSQL enum — fixing a bug where extra detail photo uploads silently failed.

### 15.3 Recent Bug Fixes (V38)

| Bug | Root Cause | Fix |
|-----|-----------|-----|
| Photo lightbox not working on stable page | `overflow: hidden` on `.passport-layout` clipped the inline lightbox | `PhotoLightbox` now uses `createPortal(…, document.body)` |
| Extra detail photos not saving | PostgreSQL `angle_profile` enum missing `extra_detail` value | Migration 090 added missing enum values |
| No feedback when photos uploaded during edit | Silent redirect with no indication of photo status | Added `photos_updated` and `photo_error` toast variants |
| Stable page missing photo angles | `ANGLE_ORDER` and `ANGLE_LABELS` missing `Belly_Makers_Mark` and `extra_detail` | Synced stable page maps with community page |

### 15.4 Recommended Next Steps

1. **Production hardening** — Rate limit tuning, error monitoring (Sentry), performance profiling
2. **Component tests** — React Testing Library coverage for critical UI flows
3. **Search infrastructure** — Server-side full-text search (Supabase pg_search or external)
4. **Image optimization** — Next.js Image component integration (currently raw `<img>`)
5. **Progressive Web App** — Offline show mode for live events without WiFi
6. **Mobile app** — React Native or Capacitor wrapper for app store presence
7. **Real-time features** — Supabase Realtime for live chat and notification push
8. **Marketplace expansion** — Escrow integration, shipping label generation

---

*This report covers the complete Model Horse Hub project as of commit `2dbeedf` (March 17, 2026). Total development time: ~12 days from first commit to current state.*
