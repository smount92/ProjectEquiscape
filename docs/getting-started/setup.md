# Local Development Setup

## Prerequisites

| Tool | Version | Notes |
|------|---------|-------|
| **Node.js** | 18+ | LTS recommended. Check with `node -v` |
| **npm** | 9+ | Bundled with Node.js. Check with `npm -v` |
| **Git** | 2.x | For version control |
| **Supabase account** | — | [supabase.com](https://supabase.com) — free tier is sufficient |
| **Vercel account** | — | [vercel.com](https://vercel.com) — for deployment (optional for local dev) |

## 1. Clone and Install

```bash
git clone <repository-url>
cd model-horse-hub
npm install
```

## 2. Environment Variables

Create a `.env.local` file in the project root. This file is **gitignored** and must never be committed.

```bash
# Copy the template
cp .env.local.example .env.local
```

> ⚠️ **If `.env.local.example` doesn't exist**, create `.env.local` manually with the variables listed below.

### Required Variables

| Variable | Where to Find It | Purpose |
|----------|-----------------|---------|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase Dashboard → Settings → API → Project URL | Public Supabase endpoint for client-side calls |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase Dashboard → Settings → API → `anon` `public` key | Public anonymous key (safe for client-side, RLS enforced) |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase Dashboard → Settings → API → `service_role` key | **Secret.** Bypasses RLS. Used server-side only via `getAdminClient()` |
| `RESEND_API_KEY` | [resend.com](https://resend.com) → API Keys | Transactional email delivery (notifications, password reset) |

### Optional Variables (E2E Testing)

| Variable | Purpose |
|----------|---------|
| `TEST_USER_A_EMAIL` | E2E test account — seller/owner role |
| `TEST_USER_A_PASSWORD` | Password for test account A |
| `TEST_USER_B_EMAIL` | E2E test account — buyer/recipient role |
| `TEST_USER_B_PASSWORD` | Password for test account B |

See [Test Accounts](test-accounts.md) for setup instructions.

## 3. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000). The app uses Turbopack for fast hot-reload.

## 4. Verify the Build

```bash
npm run build
```

This runs the Turbopack production build. It catches:
- TypeScript type errors
- Import issues and dead code
- Missing environment variables (for server-rendered pages)

The project should build with **0 errors**.

## 5. Run Tests

```bash
# Unit + integration tests (Vitest) — runs in ~600ms
npm run test:unit

# Watch mode for development
npm run test:unit:watch

# Coverage report (HTML output at coverage/)
npm run test:unit:coverage

# E2E tests (Playwright) — requires dev server running
npm run test:e2e
```

See [Testing Guide](../guides/testing.md) for detailed test strategy.

## 6. Supabase Database

### Applying Migrations

Migrations live in `supabase/migrations/` and are numbered sequentially (001–089+). To apply migrations to your Supabase project:

**Option A: Supabase CLI**
```bash
npx supabase db push
```

**Option B: Dashboard SQL Editor**
1. Open Supabase Dashboard → SQL Editor
2. Copy-paste migration SQL files in order
3. Execute each migration sequentially

### Seeding Reference Data

The reference catalog (10,500+ Breyer/Stone releases + artist resins) is seeded via scripts in `scripts/`:

```bash
# These scripts require SUPABASE_SERVICE_ROLE_KEY in .env.local
node scripts/seed_releases.mjs
node scripts/seed_erd_resins.mjs
```

See [Database → Seed Data](../database/seed-data.md) for full details.

## Common Issues

| Problem | Solution |
|---------|----------|
| `Module not found` errors | Run `npm install` — a dependency may be missing |
| Auth redirect loops | Verify `NEXT_PUBLIC_SUPABASE_URL` is correct and Supabase project is running |
| Blank dashboard | Check browser console for Supabase auth errors. Ensure the anon key matches the project URL |
| Build fails with type errors | Run `npm run build` to see full error output. Check that `src/lib/types/database.ts` matches the current schema |
| E2E tests fail | Ensure dev server is running (`npm run dev`) before running `npm run test:e2e` |

---

**Next:** [Project Structure](project-structure.md) · [Architecture Overview](../architecture/overview.md)
