# 🐴 Model Horse Hub

**The digital stable and community platform for model horse collectors.**

Model Horse Hub is a privacy-first platform purpose-built for the model horse collecting hobby. It combines inventory management, provenance tracking, social features, a marketplace, competition tools, and an art studio — all in one place.

> *"Does this feature help a collector **manage**, **show**, **sell**, or **admire** their collection?"*

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| **Digital Stable** | Catalog your herd with 10,500+ reference database entries (Breyer, Stone, Artist Resins) |
| **Hoofprint Provenance** | Permanent digital identity for every model — transfers, show records, and customization history follow the horse |
| **LSQ Photo Suite** | 5 standardized photo angles (Near-Side, Off-Side, Front, Hind, Belly) + unlimited extras |
| **Financial Vault** | Private purchase prices and estimated values — never exposed on public pages |
| **Safe-Trade Commerce** | Formal offer → accept → pay → verify → transfer state machine |
| **Art Studio** | Artist profiles, commission management, WIP photo portal |
| **Show Hosting (live + online)** | One-click NAMHSA classlist builder, entry + proxy handling, phone-based live ring console with leg-tag placing and champion callbacks, expert or community-vote judging, results that file to permanent Hoofprint records |
| **Qualification Cards** | Auto-issued on 1st/2nd, transfer with the horse on sale, public `/cards/[code]` verification page |
| **Notice Board (Groups)** | Forum-style threads, channels, pinned posts, shared files |
| **Stable Filters & Saved Views** | Faceted search across your herd with reusable saved filter sets |
| **Events** | Community clubs, event calendars, RSVP, shared files |
| **Social Feed** | Posts, comments, likes, follows, @mentions, DMs, notifications |
| **Blue Book** | Market price guide aggregated from completed transactions |

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.1.6 (App Router, Turbopack) |
| Language | TypeScript 5, React 19 |
| Database | Supabase (PostgreSQL + Row Level Security) |
| Auth | Supabase Auth (PKCE flow, cookie-based SSR) |
| Storage | Supabase Storage (private bucket, signed URLs) |
| Hosting | Vercel (serverless) |
| CSS | Tailwind CSS v4 + shadcn/ui primitives (single `globals.css` token system) |
| Email | Resend |
| PDF | @react-pdf/renderer |

## 📦 Quick Start

```bash
# Clone and install
git clone <repository-url>
cd model-horse-hub
npm install

# Configure environment: create a .env.local file in the project root
# (see docs/getting-started/setup.md for the full list of required variables)
# then fill in your Supabase and Resend credentials

# Run development server
npm run dev

# Verify the build
npm run build
```

➡️ **Full setup guide:** [docs/getting-started/setup.md](docs/getting-started/setup.md)

## 📖 Documentation

Comprehensive developer documentation lives in the [`docs/`](docs/) directory:

| Section | Contents |
|---------|----------|
| [**Getting Started**](docs/getting-started/) | [Setup](docs/getting-started/setup.md) · [Project Structure](docs/getting-started/project-structure.md) · [Test Accounts](docs/getting-started/test-accounts.md) |
| [**Architecture**](docs/architecture/) | [Overview](docs/architecture/overview.md) · [Data Flow](docs/architecture/data-flow.md) · [Auth Flow](docs/architecture/auth-flow.md) |
| [**Contributing**](CONTRIBUTING.md) | Code style, patterns, commit conventions |

➡️ **Full documentation index:** [docs/README.md](docs/README.md)

## 🧪 Testing

```bash
npm run test               # Vitest unit/integration + component tests (~5s)
npm run test:unit:watch    # Watch mode for development
npm run test:unit:coverage # Coverage report (HTML at coverage/)
npm run test:components    # Component tests only (React Testing Library)
npm run test:e2e           # Playwright E2E (requires dev server running)
npm run test:devices       # Device matrix (Desktop, iPhone, Pixel, iPad)
```

**1,031 tests across 71 test files:**
- Utility functions at 100% coverage (mentions, validation, storage, rateLimit)
- Server action integration tests (transactions, horse, provenance, collections, hoofprint, shows-v2, shows-v2-ring, groups-forum, stable, showring, catalog-suggestions)
- Domain-lib unit tests for the pure, tested `src/lib/{shows,groups,stable,showring,commerce}/` modules (state machines, card issuance, callback ladders, filter params, schemas)
- API route tests (auth, export, cron, reference-dictionary, identify-mold)
- Component tests (PhotoLightbox, TrophyCase, MarketFilters, MakeOfferModal, HoofprintTimeline, SuggestionVoteButtons, CallbackLadder) — React Testing Library
- 9 E2E specs: smoke, auth, inventory, safe-trade, hoofprint-transfer, show-entry, accessibility (axe-core WCAG 2.0 AA), device-layout (60 viewport tests), visual-qa-mobile

**Test Accounts (E2E):** Two test accounts configured in `.env.local` (TestBotA/TestBotB).

**CI:** GitHub Actions runs build + tests on every push (`.github/workflows/ci.yml`).

**Pre-commit:** Husky runs unit tests before every commit — blocks if tests fail.

## 📊 Codebase Scale

| Metric | Count |
|--------|-------|
| Page routes | 73 pages |
| Client components | ~175 |
| Server action files | 42 |
| Database migrations | 119 files (numbered 001–123; a handful of numbers skipped) |
| Reference catalog entries | 10,500+ |
| CSS files | 1 (`globals.css` — Tailwind v4 design tokens) |
| Unit/integration/component tests | 1,031 (71 test files) |
| E2E specs | 9 (Playwright + axe-core) |
| CI | GitHub Actions + Husky pre-commit |

## 🚀 Deployment

- **Git push to `main`** → Vercel auto-deploys
- **Supabase migrations** → Run via `npx supabase db push` or SQL Editor
- **Cron:** Daily 6 AM UTC → `/api/cron/refresh-market` (Blue Book price refresh)

## 📄 License

Private repository. All rights reserved.
