---
description: Sentry Integration — install @sentry/nextjs, configure error tracking, audit and replace silent catch blocks
---

# Sentry Integration & Silent Failure Mitigation

> **Constraint:** Use Sentry's Free Developer Tier (5K errors/month, 1 user). Zero cost.
> **Last Updated:** 2026-03-28
> **Status:** ✅ COMPLETE (2026-03-28)
> **Commit:** `336a6bf`
> **Prerequisite:** None — standalone feature
> **Packages:** `@sentry/nextjs`

// turbo-all

---

# ═══════════════════════════════════════
# PHASE 1: Installation & Configuration
# ═══════════════════════════════════════

## Step 1.1 — Install Sentry SDK

```
cmd /c "npm install @sentry/nextjs"
```

## Step 1.2 — Run the Sentry wizard

> **Note:** The wizard creates config files automatically. If it fails on Windows/PowerShell, create the files manually per Steps 1.3–1.6.

```
cmd /c "npx @sentry/wizard@latest -i nextjs"
```

If the wizard runs interactively, select:
- Project: Create new → "model-horse-hub"
- Framework: Next.js (App Router)
- Performance Monitoring: Yes (0% sample rate for free tier)
- Session Replay: No (paid feature)

## Step 1.3 — Create `sentry.client.config.ts`

**Target File:** `sentry.client.config.ts` (project root)

```ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,

    // Free tier: low sample rate to stay under 5K events/month
    tracesSampleRate: 0.05,

    // Only send errors in production
    enabled: process.env.NODE_ENV === "production",

    // Filter out common non-actionable errors
    ignoreErrors: [
        "ResizeObserver loop",
        "Network request failed",
        "Load failed",
        "AbortError",
    ],
});
```

## Step 1.4 — Create `sentry.server.config.ts`

**Target File:** `sentry.server.config.ts` (project root)

```ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    environment: process.env.NODE_ENV,
    tracesSampleRate: 0.05,
    enabled: process.env.NODE_ENV === "production",
});
```

## Step 1.5 — Create `sentry.edge.config.ts`

**Target File:** `sentry.edge.config.ts` (project root)

```ts
import * as Sentry from "@sentry/nextjs";

Sentry.init({
    dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
    tracesSampleRate: 0.05,
    enabled: process.env.NODE_ENV === "production",
});
```

## Step 1.6 — Wrap next.config.ts with Sentry

**Target File:** `next.config.ts`

```ts
import type { NextConfig } from "next";
import { withSentryConfig } from "@sentry/nextjs";

const nextConfig: NextConfig = {
    /* existing config */
};

export default withSentryConfig(nextConfig, {
    // Suppress source map upload noise in CI
    silent: true,
    // Don't widen the upload scope
    widenClientFileUpload: false,
    // Disable automatic instrumentation tunnel (free tier doesn't need it)
    tunnelRoute: undefined,
});
```

## Step 1.7 — Create instrumentation hook

**Target File:** `src/instrumentation.ts` (NEW FILE)

```ts
export async function register() {
    if (process.env.NEXT_RUNTIME === "nodejs") {
        await import("../sentry.server.config");
    }
    if (process.env.NEXT_RUNTIME === "edge") {
        await import("../sentry.edge.config");
    }
}
```

## Step 1.8 — Add environment variables

**Target File:** `.env.local` (add — DO NOT commit)

```
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@o123456.ingest.sentry.io/your-project-id
```

**Target File:** `docs/guides/deployment.md` — add to the env var table:

| Variable | Purpose | Source |
|----------|---------|--------|
| `NEXT_PUBLIC_SENTRY_DSN` | Sentry error tracking | Sentry Dashboard → Settings → Client Keys |

## Verify Phase 1

```
cmd /c "npx next build 2>&1 | findstr /C:error /C:Error /C:compiled"
```

Check that:
- [ ] Build compiles with Sentry wrapper
- [ ] No runtime errors on dev server
- [ ] `sentry.client.config.ts`, `sentry.server.config.ts`, `sentry.edge.config.ts` exist

---

# ═══════════════════════════════════════
# PHASE 2: The Silent Catch Audit
# ═══════════════════════════════════════

## Step 2.1 — Grep for empty/silent catch blocks

Run these searches to identify every swallowed error in server actions and API routes:

```
cmd /c "findstr /S /N /C:"catch" src\app\actions\*.ts"
```

```
cmd /c "findstr /S /N /C:"catch" src\app\api\*.ts"
```

Look for patterns like:
- `catch { /* ignore */ }`
- `catch { /* non-blocking */ }`
- `catch { /* silently fail */ }`
- `catch (e) { console.error(e) }` (only logs, no alerting)

## Step 2.2 — Categorize catch blocks

Create a checklist of every catch block found. For each, decide:

| Pattern | Action |
|---------|--------|
| `catch { /* non-blocking notification/activity */ }` | Add `Sentry.captureException(error, { level: "warning" })` |
| `catch (err) { console.error(...) }` in API routes | Add `Sentry.captureException(err)` alongside the log |
| `catch { /* ignore */ }` in auth/header | Leave as-is (auth token parsing failures are expected) |
| `catch` in `fetchHeaderInfo` (Header.tsx) | Leave as-is (non-critical UI fetch) |

## Step 2.3 — Instrument critical paths

**Priority targets** (these are the most dangerous silent failures):

1. **Stripe webhook handler** (`src/app/api/webhooks/stripe/route.ts`)
   - Any catch block must `Sentry.captureException(err)` — a missed webhook = lost revenue

2. **Cron jobs** (`src/app/api/cron/*/route.ts`)
   - Add `Sentry.captureException` to catch blocks — silent cron failures compound over days

3. **Notification creation** (`src/app/actions/notifications.ts`)
   - If `createNotification` fails silently, users miss commerce events

4. **Transaction state machine** (`src/app/actions/transactions.ts`)
   - Commerce mutations are critical path — any error must alert

**Implementation pattern:**

```ts
import * as Sentry from "@sentry/nextjs";

// Replace:
catch { /* non-blocking */ }

// With:
catch (err) {
    Sentry.captureException(err, {
        tags: { domain: "commerce" },
        level: "error",
    });
}
```

## Step 2.4 — Create a global error boundary with Sentry

**Target File:** `src/app/global-error.tsx` (NEW FILE)

```tsx
"use client";

import * as Sentry from "@sentry/nextjs";
import { useEffect } from "react";

export default function GlobalError({
    error,
    reset,
}: {
    error: Error & { digest?: string };
    reset: () => void;
}) {
    useEffect(() => {
        Sentry.captureException(error);
    }, [error]);

    return (
        <html>
            <body>
                <div className="flex min-h-screen flex-col items-center justify-center gap-4 p-8">
                    <h2 className="text-2xl font-bold">Something went wrong</h2>
                    <p className="text-muted">We've been notified and are looking into it.</p>
                    <button onClick={reset} className="btn btn-primary">
                        Try Again
                    </button>
                </div>
            </body>
        </html>
    );
}
```

## Verify Phase 2

```
cmd /c "npx next build 2>&1 | findstr /C:error /C:Error /C:compiled"
```

```
cmd /c "npx vitest run 2>&1"
```

Check that:
- [ ] All critical catch blocks now call `Sentry.captureException`
- [ ] Auth/header silent catches are intentionally left alone
- [ ] `global-error.tsx` exists
- [ ] Build passes
- [ ] All tests pass

---

## Commit

```
cd c:\Project Equispace\model-horse-hub && git add -A && git commit -m "feat: sentry integration — error tracking, silent catch audit, global error boundary"
```
