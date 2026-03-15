This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Testing

### Unit & Integration Tests (Vitest) — 132+ tests
```bash
npm run test:unit          # Single run (~600ms)
npm run test:unit:watch    # Watch mode for development
npm run test:unit:coverage # Coverage report (HTML at coverage/)
```

Coverage includes:
- **4 utility files** at 100% coverage (mentions, validation, storage, rateLimit)
- **5 server action files** with integration tests (transactions, horse, provenance, collections, hoofprint)
- **5 API routes** tested (auth/me, export, cron/refresh-market, reference-dictionary, identify-mold)

### E2E Tests (Playwright) — 20+ specs
```bash
npm run test:e2e           # Headless Chromium (requires dev server)
```

Includes smoke tests, auth flow, inventory CRUD, show entry, safe-trade scaffolds, hoofprint transfer scaffolds, performance benchmark, and axe-core accessibility audits.

### Test Accounts (E2E)
Two test accounts configured in `.env.local`:
- `TEST_USER_A_EMAIL` / `TEST_USER_A_PASSWORD` — seller/owner role
- `TEST_USER_B_EMAIL` / `TEST_USER_B_PASSWORD` — buyer/recipient role

### Pre-Commit
Husky runs unit tests on every commit. E2E tests should be run manually before push.

### Coverage
Coverage thresholds enforced at 37% (statements, lines, functions, branches) on `src/lib/**`.

### Environment
Unit tests use a mocked Supabase client (no live DB connection required).
E2E tests run against the live dev server.

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
