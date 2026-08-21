# 🐴 Model Horse Hub

**The digital stable and community platform for model horse collectors.**

Model Horse Hub is a privacy-first platform purpose-built for the model horse collecting hobby. It combines inventory management, provenance tracking, social features, a marketplace, competition tools, and an art studio — all in one place.

> *"Does this feature help a collector **manage**, **show**, **sell**, or **admire** their collection?"*

## 🏠 The Five Rooms

The site is five rooms. The nav bar holds exactly these, at any screen width; everything else lives under **More**.

| Room | Route | What it is |
|------|-------|------------|
| **Stable** | `/dashboard` | Your herd — inventory, filters, saved views, the vault |
| **Shows** | `/shows` | Hosting, entering, judging, results, qualification cards |
| **Market** | `/market` | The marketplace front door — listings, Blue Book, deals |
| **The Paddock** | `/feed` | The community room — one stream, plus the door to the Show Ring |
| **Registry** | `/catalog` | The 10,900+ entry reference catalog |

Under More: Art Studio, Show Ring, Barns, Events, Help ID, Members.

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| **Digital Stable** | Catalog your herd against 10,900+ Registry entries (Breyer, Stone, Artist Resins, pewter micro-minis) filterable by maker, scale, and material. Faceted search with reusable saved views, a condition ledger, and `/stable/deleted` to undo a soft delete |
| **Hoofprint Provenance** | Permanent digital identity for every model — transfers, show records, titles, and customization history follow the horse |
| **LSQ Photo Suite** | 5 standardized photo angles (Near-Side, Off-Side, Front, Hind, Belly) + unlimited extras, with automatic (opt-out) photo watermarking and optional custom watermark text |
| **Financial Vault** | Private purchase prices, estimated values, and commission costs — never exposed on public pages |
| **The Market** | Provenance-first listing cards where the passport *is* the listing page. Browsable logged-out. Blocked sellers are excluded at the query level |
| **The Deal Room** | A DM thread that grows into a deal: offers and counter-offers, contract boxes both parties sign, an installment ledger for time payments, and an evidence pack (PDF + plain text) at `/inbox/[id]/record`. **The platform never holds money and charges no selling fees** — it keeps the record, it does not referee |
| **Art Studio** | Studio pages with structured, comparable terms; a commission pipeline from request through quote, work, approval and delivery; a receipts wall of finished horses shown with the ribbons they went on to win |
| **Show Hosting (live + online)** | One-click NAMHSA classlist builder, entry + proxy handling, phone-based live ring console with leg-tag placing and champion callbacks, expert or community-vote judging, results that file to permanent Hoofprint records |
| **Qualification Cards** | Auto-issued on 1st/2nd, transfer with the horse on sale, public `/cards/[code]` verification page |
| **The Paddock** | One stream: posts, public-horse comments, barn posts and show results, with @mentions, per-post Public/Followers visibility, and an Everyone/Following toggle |
| **Barns** | Community barns with a notice board, private barns with a join-request queue, shared files, and per-user unread state |
| **Events** | Listing pages for happenings *outside* MHH — RSVP, attendees, discussion, photos |
| **Blue Book** | Market price guide at `/market/guide`, aggregated from completed transactions |
| **Members** | Server-side member directory with search and three sorts |

## 🛠️ Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16.1.6 (App Router, Turbopack) |
| Language | TypeScript 5, React 19 |
| Database | Supabase (PostgreSQL + Row Level Security) |
| Auth | Supabase Auth (PKCE flow, cookie-based SSR) |
| Storage | Supabase Storage — public `horse-images` bucket (CDN-cacheable), private `chat-attachments` and `group-files` buckets (signed URLs) |
| Hosting | Vercel (serverless) |
| CSS | Tailwind CSS v4 + shadcn/ui primitives (single `globals.css` token system) |
| PWA | Serwist (`src/app/sw.ts` → `public/sw.js`) — offline barn mode for live shows |
| Payments | Stripe Checkout Sessions + webhooks |
| Email | Resend |
| PDF | @react-pdf/renderer |
| Monitoring | Sentry + Vercel Web Analytics (first-party, cookieless) |

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

**155 unit/integration/component test files** (~2,400 tests at the launch release):
- Utility functions at 100% coverage (mentions, validation, storage, rateLimit)
- Server action integration tests (transactions, deals, horse, provenance, collections, hoofprint, shows-v2, shows-v2-ring, shows-v4, groups, groups-forum, stable, showring, admin, catalog-suggestions)
- Domain-lib unit tests for the pure `src/lib/<domain>/` modules — state machines, the commission pipeline, deal vocabulary, card issuance, callback ladders, mention matching, filter params, metrics hashing, schemas
- API route tests (auth, export, cron, beacon, reference-dictionary)
- Component tests (React Testing Library)
- 10 E2E specs including accessibility (axe-core WCAG 2.0 AA) and a device matrix

**Test Accounts (E2E):** Two test accounts configured in `.env.local` (TestBotA/TestBotB).

**CI:** GitHub Actions runs build + tests on every push (`.github/workflows/ci.yml`).

**Pre-commit:** Husky runs unit tests before every commit — blocks if tests fail.

## 📊 Codebase Scale

| Metric | Count |
|--------|-------|
| Page routes | 94 |
| API routes | 18 (plus `/auth/callback` and the Serwist handler, both outside `/api`) |
| Server action files | 58 |
| Database migrations | 170 files (numbered 001–175; 045/047/049/051/174 skipped) |
| Reference catalog entries | 10,900+ |
| CSS files | 1 (`globals.css` — Tailwind v4 design tokens, ~3,980 lines) |
| Test files | 155 unit/integration/component + 10 Playwright E2E specs |
| Live feature flags | 4 (2 of them dark — see `.agents/MASTER_BLUEPRINT.md`) |
| CI | GitHub Actions + Husky pre-commit |

## 🚀 Deployment

- **Git push to `main`** → Vercel auto-deploys
- **Supabase migrations** → files only; the owner pastes them into the Supabase SQL Editor by hand. App code must feature-detect so it works both before and after the paste
- **Cron** (`vercel.json`):
  - `0 6 * * *` → `/api/cron/refresh-market` (Blue Book refresh, trusted sellers, garbage collection)
  - `0 * * * *` → `/api/cron/transition-shows`
  - `0 9 1 * *` → `/api/cron/stablemaster-agent`

> **Build note:** `next.config.ts` pins `experimental.cpus: 6`. Do not remove it — Vercel's build machine otherwise spawns 29 static-generation workers, which stampedes the Supabase connection pool and fails the build.

## 📄 License

Private repository. All rights reserved.
