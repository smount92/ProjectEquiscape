# 🐴 Model Horse Hub

**The digital stable and community platform for model horse collectors.**

Model Horse Hub is a privacy-first platform purpose-built for the model horse collecting hobby. It combines inventory management, provenance tracking, social features, a marketplace, competition tools, and an art studio — all in one place.

> *"Does this feature help a collector **manage**, **show**, **sell**, or **admire** their collection?"*

## ✨ Key Features

| Feature | Description |
|---------|-------------|
| **Digital Stable** | Catalog your herd with 10,500+ reference database entries (Breyer, Stone, Artist Resins) |
| **Hoofprint™ Provenance** | Permanent digital identity for every model — transfers, show records, and customization history follow the horse |
| **LSQ Photo Suite** | 5 standardized photo angles (Near-Side, Off-Side, Front, Hind, Belly) + unlimited extras |
| **Financial Vault** | Private purchase prices and estimated values — never exposed on public pages |
| **Safe-Trade Commerce** | Formal offer → accept → pay → verify → transfer state machine |
| **Art Studio** | Artist profiles, commission management, WIP photo portal |
| **Competition Engine** | Photo shows, expert judging, NAMHSA-style division/class hierarchy |
| **Groups & Events** | Community clubs, event calendars, RSVP, shared files |
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
| CSS | Vanilla CSS design system + 19 CSS Modules |
| Email | Resend |
| PDF | @react-pdf/renderer |

## 📦 Quick Start

```bash
# Clone and install
git clone <repository-url>
cd model-horse-hub
npm install

# Configure environment (see docs/getting-started/setup.md)
cp .env.local.example .env.local
# Edit .env.local with your Supabase and Resend credentials

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
npm run test:unit          # Vitest unit/integration tests (~600ms)
npm run test:unit:watch    # Watch mode for development
npm run test:unit:coverage # Coverage report (HTML at coverage/)
npm run test:e2e           # Playwright E2E (requires dev server running)
```

**Coverage includes:**
- Utility files at 100% coverage (mentions, validation, storage, rateLimit)
- Server action integration tests (transactions, horse, provenance, collections, hoofprint)
- API route tests (auth, export, cron, reference-dictionary, identify-mold)
- 7 E2E specs: smoke, auth, inventory, safe-trade, hoofprint-transfer, show-entry, accessibility

**Pre-commit:** Husky runs unit tests on every commit.

## 📊 Codebase Scale

| Metric | Count |
|--------|-------|
| Page routes | 28+ route groups |
| Client components | 110 |
| Server action files | 35 |
| Database migrations | 85 (001–089) |
| Reference catalog entries | 10,500+ |
| CSS Modules | 19 |

## 🚀 Deployment

- **Git push to `main`** → Vercel auto-deploys
- **Supabase migrations** → Run via `npx supabase db push` or SQL Editor
- **Cron:** Daily 6 AM UTC → `/api/cron/refresh-market` (Blue Book price refresh)

## 📄 License

Private repository. All rights reserved.
