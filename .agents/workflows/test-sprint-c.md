---
description: Test Sprint C — Launch Readiness. API route tests, unskip 13 E2E flows, axe-core accessibility, coverage ratchet to 60%, Husky pre-commit hooks. Final testing sprint before public launch.
---

# Test Sprint C: Launch Readiness

> **Context:** Sprints A+B delivered 112 Vitest tests and 7 live E2E tests. Current coverage is **38% statements** across `src/lib/**`. Sprint C closes the remaining gaps: API route tests, accessibility, unskipping the 13 scaffolded E2E flows, and enforcing quality gates with pre-commit hooks. This is the last testing sprint before public launch.
>
> **Pre-requisites:** Test Sprint B complete. 112 Vitest tests passing. 2 test accounts (TestBotA/TestBotB) created and functional. Clean build.
>
> **Dependencies to install:** `@axe-core/playwright`, `husky`

// turbo-all

---

## Developer Agent Rules

> **MANDATORY:**
> - Run `npm run test:unit` after each Vitest task.
> - Run `npm run test:e2e` after each Playwright task (requires dev server running).
> - Run `npx next build` before final commit.
> - When unskipping E2E tests, if a test is flaky due to race conditions (e.g., page load timing), use `page.waitForSelector()` or `page.waitForLoadState('networkidle')` rather than `page.waitForTimeout()`.
> - Commit after each task group.

---

## PART 1: API Route Tests (Vitest)

API routes are Next.js `route.ts` handlers that export GET/POST functions. They can be tested by importing the handler and passing a mock `NextRequest`.

### Mocking Pattern for Route Handlers

```typescript
import { vi, describe, it, expect, beforeEach } from "vitest";
import { NextRequest } from "next/server";
import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";

const mockClient = createMockSupabaseClient();
vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => Promise.resolve(mockClient)),
}));

// Helper to create mock NextRequest
function mockRequest(url: string, options?: RequestInit) {
    return new NextRequest(new URL(url, "http://localhost:3000"), options);
}
```

---

## Task 1: API Route Tests — `auth/me`

Create `src/app/api/__tests__/auth-me.test.ts`.

| Scenario | Expected |
|----------|----------|
| Authenticated user | `{ userId: "test-user-id" }`, status 200 |
| Unauthenticated (getUser returns null) | `{ userId: null }`, status 200 |

**Total: 2 tests**

---

## Task 2: API Route Tests — `export` (CSV)

Create `src/app/api/__tests__/export.test.ts`.

| Scenario | Expected |
|----------|----------|
| Authenticated, has horses | Status 200, Content-Type = `text/csv`, body starts with BOM + header row |
| Authenticated, no horses | Status 200, CSV has headers but no data rows |
| Unauthenticated | Status 401, `{ error: "Unauthorized" }` |
| Verify `escapeCSV()` handles commas | `"value,with,commas"` → `"\"value,with,commas\""` |
| Verify `escapeCSV()` handles quotes | `'value"with"quotes'` → `"value""with""quotes"` |
| Verify `escapeCSV()` handles null | `null` → `""` |

> **Note:** Import and test `escapeCSV` directly as a unit test in addition to the route handler test.

**Total: ~6 tests**

---

## Task 3: API Route Tests — `cron/refresh-market`

Create `src/app/api/__tests__/cron-refresh-market.test.ts`.

```typescript
vi.mock("@/lib/supabase/admin", () => ({
    getAdminClient: vi.fn(() => ({
        rpc: vi.fn().mockResolvedValue({ data: null, error: null }),
    })),
}));
```

| Scenario | Expected |
|----------|----------|
| Valid CRON_SECRET header | Status 200, `{ success: true, refreshedAt: "..." }` |
| Missing/wrong auth header | Status 401, `{ error: "Unauthorized" }` |
| RPC failure | Status 500 |

> **Setup:** Use `vi.stubEnv("CRON_SECRET", "test-cron-secret")` and pass `authorization: "Bearer test-cron-secret"` header.

**Total: 3 tests**

---

## Task 4: API Route Tests — `reference-dictionary`

Create `src/app/api/__tests__/reference-dictionary.test.ts`.

| Scenario | Expected |
|----------|----------|
| Returns releases and resins arrays | `{ releases: [...], resins: [...] }` |
| Releases have compressed keys (i, n, m, c, mn, mf) | Verify key shape |
| Resins have compressed keys (i, n, s) | Verify key shape |
| Cache-Control header set to 1 day | `"public, max-age=86400, s-maxage=86400"` |
| Empty catalog → empty arrays | `{ releases: [], resins: [] }` |

**Total: ~5 tests**

---

## Task 5: API Route Tests — `identify-mold`

Create `src/app/api/__tests__/identify-mold.test.ts`.

This route calls the Gemini API — mock `fetch` globally.

| Scenario | Expected |
|----------|----------|
| Unauthenticated | Status 401 |
| Rate limited | Status 429 |
| No image provided | Status 400 |
| Successful identification (mock Gemini response) | Status 200 with mold data |

> **Note:** Mock the global `fetch` for the Gemini API call. Don't actually call the AI.

**Total: ~4 tests**

---

## PART 2: Unskip E2E Flows

### E2E Data Setup Strategy

Some E2E tests require pre-existing data (a horse to edit, a show record to clear). Use a `beforeAll` or `beforeEach` block to create test data via the UI or API, or rely on data created by earlier tests in the same `describe` block.

> **Important rule:** E2E tests should clean up after themselves when possible. If a test creates a horse, the delete test should remove it. Use `test.describe.serial()` to enforce test order within a group.

---

## Task 6: Unskip `inventory.spec.ts` (3 tests)

Use `test.describe.serial()` since delete depends on add:

```typescript
test.describe.serial("Inventory Flow", () => {
    let testHorseName: string;

    test("add horse via quick add → appears on dashboard", async ({ page }) => {
        await loginAs(page, USER_A.email, USER_A.password);
        testHorseName = `E2E Test Horse ${Date.now()}`;
        await page.goto("/add-horse/quick");
        // Fill: custom name, finish type (select), condition (select)
        // Submit → verify redirect to passport or dashboard
        // Navigate to dashboard → verify horse name visible
    });

    test("edit horse name → change persists", async ({ page }) => {
        await loginAs(page, USER_A.email, USER_A.password);
        // Find the test horse on dashboard → click → go to passport
        // Click "Edit Details" → change name → save → verify new name
    });

    test("delete horse → removed from dashboard", async ({ page }) => {
        await loginAs(page, USER_A.email, USER_A.password);
        // Find the test horse → go to passport → click delete → confirm
        // Navigate to dashboard → verify horse is gone
    });
});
```

---

## Task 7: Unskip `show-entry.spec.ts` (2 tests)

Depends on a horse existing. Either create one in `beforeAll` or rely on a persistent test horse.

```typescript
test("add show record to horse → appears in timeline", async ({ page }) => {
    await loginAs(page, USER_A.email, USER_A.password);
    // Navigate to a horse passport (use first horse on dashboard)
    // Click "Add Record" → fill show name, class name, placing, ribbon
    // Save → verify record appears in timeline with correct data
});

test("edit show record notes → can clear to empty (regression)", async ({ page }) => {
    await loginAs(page, USER_A.email, USER_A.password);
    // Navigate to the show record just created → click edit
    // Type something in notes → save
    // Edit again → clear notes completely → save
    // Verify notes field is empty after page reload
});
```

---

## Task 8: Unskip `safe-trade.spec.ts` — First 2 Tests

Use two browser contexts (one per user):

```typescript
test("Seller lists horse as For Sale", async ({ page }) => {
    await loginAs(page, USER_A.email, USER_A.password);
    // Navigate to a horse → Edit → set trade status = "For Sale"
    // Set listing price → save
    // Verify badge/status shows on passport
});

test("Buyer sees horse in Show Ring and can message seller", async ({ page }) => {
    await loginAs(page, USER_B.email, USER_B.password);
    await page.goto("/community");
    // Search or scroll for the horse listed by User A
    // Verify "For Sale" badge visible
    // Click horse → verify "Message Seller" or "Make Offer" button visible
});
```

> Keep tests 3-5 (accept, pay, verify) as `test.fixme` — they require cross-context state coordination that's complex for this sprint.

---

## Task 9: Unskip `hoofprint-transfer.spec.ts` — First Test

```typescript
test("Owner generates transfer code", async ({ page }) => {
    await loginAs(page, USER_A.email, USER_A.password);
    // Navigate to a horse passport → click "Transfer"
    // Fill acquisition type → submit
    // Verify: 6-character code appears on screen
    // Verify: code matches pattern /^[A-Z0-9]{6}$/
});
```

> Keep tests 2-3 (claim + ownership swap) as `test.fixme` with a comment about multi-context complexity.

---

## PART 3: Accessibility Audit

## Task 10: Install axe-core + Create Accessibility Test

### Step 1: Install
```
npm install --save-dev @axe-core/playwright
```

### Step 2: Create `e2e/accessibility.spec.ts`

```typescript
import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { loginAs, USER_A } from "./helpers/auth";

test.describe("Accessibility Audit", () => {
    test("landing page has no critical a11y violations", async ({ page }) => {
        await page.goto("/");
        const results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa"])
            .disableRules(["color-contrast"]) // Disable if dark theme causes false positives
            .analyze();

        // Allow minor violations but fail on critical/serious
        const critical = results.violations.filter(
            v => v.impact === "critical" || v.impact === "serious"
        );
        
        if (critical.length > 0) {
            console.log("Critical a11y violations:", JSON.stringify(critical, null, 2));
        }
        expect(critical).toHaveLength(0);
    });

    test("login page has no critical a11y violations", async ({ page }) => {
        await page.goto("/login");
        const results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa"])
            .disableRules(["color-contrast"])
            .analyze();

        const critical = results.violations.filter(
            v => v.impact === "critical" || v.impact === "serious"
        );
        expect(critical).toHaveLength(0);
    });

    test("dashboard has no critical a11y violations", async ({ page }) => {
        await loginAs(page, USER_A.email, USER_A.password);
        await page.goto("/dashboard");
        await page.waitForLoadState("networkidle");
        
        const results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa"])
            .disableRules(["color-contrast"])
            .analyze();

        const critical = results.violations.filter(
            v => v.impact === "critical" || v.impact === "serious"
        );
        expect(critical).toHaveLength(0);
    });

    test("Show Ring (public) has no critical a11y violations", async ({ page }) => {
        await page.goto("/community");
        const results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa"])
            .disableRules(["color-contrast"])
            .analyze();

        const critical = results.violations.filter(
            v => v.impact === "critical" || v.impact === "serious"
        );
        expect(critical).toHaveLength(0);
    });
});
```

> **Note:** `color-contrast` is disabled because dark-mode custom themes often trigger false positives. Re-enable once theme colors are finalized.

---

## PART 4: Quality Gates

## Task 11: Ratchet Coverage Thresholds

Update `vitest.config.ts` coverage thresholds from 50% to 60%:

```typescript
thresholds: {
    lines: 60,
    functions: 60,
    branches: 50,  // Keep branches at 50 (hardest to increase)
    statements: 60,
},
```

> **Important:** Run `npm run test:unit:coverage` first to verify we're above 60%. If not, write additional tests in the weakest areas before ratcheting. Current baseline is 38% statements — the Sprint C API route tests should push this higher. If still below 60%, add tests for `imageCompression.ts` or additional utility functions.

Also set `passWithNoTests: false` in vitest config to enforce test presence:

```typescript
passWithNoTests: false,  // Ratcheted from true (Sprint A) → false (Sprint C)
```

---

## Task 12: Husky Pre-Commit Hooks

### Step 1: Install Husky
```
npm install --save-dev husky
npx husky init
```

### Step 2: Create pre-commit hook

Create `.husky/pre-commit`:
```bash
#!/bin/sh

# Run unit tests (fast — ~300ms)
npx vitest run --reporter=dot 2>&1 | tail -5

# If tests fail, block the commit
if [ $? -ne 0 ]; then
    echo "❌ Unit tests failed. Fix before committing."
    exit 1
fi

echo "✅ All tests passed."
```

### Step 3: Add to package.json scripts
```json
"prepare": "husky"
```

> **Note:** This only runs Vitest (fast, ~300ms). It does NOT run Playwright E2E (slow, requires dev server). E2E tests should be run manually before push.

---

## Task 13: Update README Testing Section

Update the testing section in `README.md` to reflect the complete test suite:

```markdown
## Testing

### Unit Tests (Vitest) — 112+ tests
```bash
npm run test:unit          # Single run (~300ms)
npm run test:unit:watch    # Watch mode for development
npm run test:unit:coverage # Coverage report (HTML at coverage/)
```

### E2E Tests (Playwright) — 20+ specs
```bash
npm run test:e2e           # Headless Chromium (requires dev server)
```

### Test Accounts (E2E)
Two test accounts are configured in `.env.local`:
- `TestBotA` — seller/owner role
- `TestBotB` — buyer/recipient role

### Pre-Commit
Husky runs unit tests on every commit. E2E tests should be run manually before push.

### Coverage
Coverage thresholds enforced at 60% (statements, lines, functions).
```

---

## Task 14: Verify and Report

### Step 1: Run full unit + integration suite
```
npm run test:unit
```

### Step 2: Run with coverage (verify thresholds)
```
npm run test:unit:coverage
```

### Step 3: Run E2E
```
npm run test:e2e
```

### Step 4: Verify build
```
npx next build
```

### Step 5: Test pre-commit hook
```
git add -A
git commit -m "test: Test Sprint C — API routes, unskipped E2E, accessibility, coverage enforcement, Husky hooks"
```

Husky should run and show ✅ before the commit completes.

---

# Expected Outcomes

After this sprint:
- **~130+ Vitest tests** (112 existing + ~20 API route tests)
- **~20 live Playwright E2E tests** (7 existing + 8 unskipped + 4 accessibility + 1 perf)
- **5 API routes** fully tested
- **4 pages** accessibility-audited via axe-core
- **60% coverage** enforced on `src/lib/**`
- **Husky pre-commit hook** blocking broken commits
- **3 E2E specs** remaining as `test.fixme` (multi-context flows for full commerce + transfer)
- Ready for public launch 🚀
