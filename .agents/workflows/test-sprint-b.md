---
description: Test Sprint B — Critical Paths. Integration tests for 5 server action files, flesh out 2 existing E2E specs, add 3 new E2E flows, one Playwright perf benchmark. Builds on Sprint A foundation.
---

# Test Sprint B: Critical Path Coverage

> **Context:** Sprint A delivered vitest config, Supabase mock factory, 59 passing unit tests, and 3 E2E smoke tests. Sprint B now covers the **load-bearing server actions** (where bugs = financial trust erosion) and fills in the E2E scaffolds with real flows.
>
> **Pre-requisites:** Test Sprint A complete. All 59 unit tests passing (`npm run test:unit`). Playwright smoke tests running.
>
> **Test accounts required for E2E:** Two Supabase auth accounts (credentials in `.env.local` or Playwright `.env`):
> - `TEST_USER_A_EMAIL` / `TEST_USER_A_PASSWORD` (the "seller/owner")
> - `TEST_USER_B_EMAIL` / `TEST_USER_B_PASSWORD` (the "buyer/recipient")
>
> If these don't exist, create them via Supabase Dashboard before starting E2E tasks.

// turbo-all

---

## Developer Agent Rules

> **MANDATORY:** 
> - Run `npm run test:unit` after each integration test task.
> - Run `npx next build` after all tasks before final commit.
> - Server actions use `createClient()` from `@/lib/supabase/server` which cannot run outside Next.js. **You must mock the entire module**, not just the client.
> - Integration tests mock at the module boundary (vi.mock), not at the network layer.
> - E2E tests run against the live dev server — **do not mock anything** in E2E.
> - Commit after each task group.

---

## PART 1: Integration Tests (Vitest + Mock Factory)

### Mocking Pattern

Every server action imports `createClient` from `@/lib/supabase/server`. The test pattern is:

```typescript
import { vi, describe, it, expect, beforeEach } from "vitest";
import { createMockSupabaseClient } from "@/__tests__/mocks/supabase";

// Mock the Supabase server client module
const mockClient = createMockSupabaseClient();
vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => Promise.resolve(mockClient)),
}));

// Mock revalidatePath/revalidateTag (no-ops in tests)
vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
    revalidateTag: vi.fn(),
}));

// Mock the admin client if the action uses it
vi.mock("@/lib/supabase/admin", () => ({
    getAdminClient: vi.fn(() => createMockSupabaseClient()),
}));
```

> **Important:** Place all `vi.mock()` calls at the top of the test file, before any imports from the module under test. Vitest hoists them automatically.

---

## Task 1: Integration Tests — `transactions.ts` (Commerce State Machine)

Create `src/app/actions/__tests__/transactions.test.ts`.

This is the **most critical** test file — incorrect states here mean financial bugs and trust erosion.

### Test: `makeOffer`
| Scenario | Expected |
|----------|----------|
| Valid offer (horse exists, For Sale, different user) | `{ success: true, transactionId: "...", conversationId: "..." }` |
| Buyer tries to buy own horse | `{ success: false, error: /own horse/i }` |
| Horse not found or not "For Sale" | `{ success: false }` |
| Amount ≤ 0 | `{ success: false }` |
| Unauthenticated user | `{ success: false, error: /logged in/i }` |

### Test: `respondToOffer`
| Scenario | Expected |
|----------|----------|
| Seller accepts → status changes to `pending_payment` | `{ success: true }`, verify `.update()` called with `pending_payment` |
| Seller declines → status changes to `declined` | `{ success: true }`, verify status = `declined` |
| Non-seller tries to respond | `{ success: false }` |
| Already-accepted offer | `{ success: false }` |

### Test: `markPaymentSent`
| Scenario | Expected |
|----------|----------|
| Valid: status was `pending_payment`, buyer calls | `{ success: true }` → status = `funds_verified` |
| Wrong status (e.g., `offer_made`) | `{ success: false }` |
| Non-buyer calls | `{ success: false }` |

### Test: `verifyFundsAndRelease`
| Scenario | Expected |
|----------|----------|
| Valid: status was `funds_verified`, seller calls | `{ success: true, pin: "..." }` |
| Wrong status | `{ success: false }` |

### Test: `cancelTransaction`
| Scenario | Expected |
|----------|----------|
| Seller cancels during `pending_payment` | `{ success: true }` |
| Cannot cancel a `completed` transaction | `{ success: false }` |

### Test: `retractOffer`
| Scenario | Expected |
|----------|----------|
| Buyer retracts during `offer_made` | `{ success: true }` |
| Cannot retract after accepted | `{ success: false }` |

**Total expected tests: ~15-18**

---

## Task 2: Integration Tests — `hoofprint.ts` (Transfer System)

Create `src/app/actions/__tests__/hoofprint.test.ts`.

### Test: `generateTransferCode`
| Scenario | Expected |
|----------|----------|
| Owner generates code for own horse | `{ success: true, code: /[A-Z0-9]{6}/ }` |
| Non-owner tries | `{ success: false }` |
| Horse is Stolen/Missing | `{ success: false, error: /Stolen/i }` |
| Horse already has pending transfer | `{ success: false }` |
| Unauthenticated | `{ success: false }` |

### Test: `claimTransfer`
| Scenario | Expected |
|----------|----------|
| Valid code, different user | `{ success: true, horseName: "...", horseId: "..." }` |
| Invalid / expired code | `{ success: false }` |
| Owner tries to claim own horse | `{ success: false }` |
| Already-claimed code | `{ success: false }` |

### Test: `generateCode` (pure function)
| Input | Expected |
|-------|----------|
| Called multiple times | 6-char uppercase alphanumeric, unique across calls |

### Test: `updateLifeStage`
| Scenario | Expected |
|----------|----------|
| Valid stage change | `{ success: true }` |
| Non-owner | `{ success: false }` |

**Total expected tests: ~12-15**

---

## Task 3: Integration Tests — `horse.ts` (CRUD)

Create `src/app/actions/__tests__/horse.test.ts`.

### Test: `createHorseRecord`
| Scenario | Expected |
|----------|----------|
| Valid data (name + finish type) | `{ success: true, horseId: "..." }` |
| Missing required name | `{ success: false }` |
| Unauthenticated | `{ success: false }` |
| Verifies sanitizeText is called on name | Check that name is sanitized |

### Test: `deleteHorse`
| Scenario | Expected |
|----------|----------|
| Owner deletes own horse | `{ success: true }` |
| Horse with active transaction | `{ success: false, error: /active transaction/i }` |
| Non-owner | `{ success: false }` |

### Test: `quickAddHorse`
| Scenario | Expected |
|----------|----------|
| Minimal data (finish type + condition) | `{ success: true, horseId: "..." }` |
| Auto-generates name from catalog if catalogId present | Verify name logic |

### Test: `bulkUpdateHorses`
| Scenario | Expected |
|----------|----------|
| Valid batch update (visibility change) | `{ success: true, count: N }` |
| Empty array | `{ success: false }` or no-op |
| Non-owner's horses | Only updates owned horses |

**Total expected tests: ~10-12**

---

## Task 4: Integration Tests — `collections.ts` (M:N Junction)

Create `src/app/actions/__tests__/collections.test.ts`.

### Test: `createCollectionAction`
| Scenario | Expected |
|----------|----------|
| Valid name | `{ success: true, data: { id, name } }` |
| Unauthenticated | `{ success: false }` |

### Test: `setHorseCollections`
| Scenario | Expected |
|----------|----------|
| Set 2 collections on a horse | Verify: delete existing → insert 2 rows → update legacy FK to first |
| Set empty array (remove all) | Verify: delete all → no insert → legacy FK = null |
| Non-owner's horse | `{ success: false }` |

### Test: `deleteCollectionAction`
| Scenario | Expected |
|----------|----------|
| Valid deletion | Cleans up junction table rows + unsets legacy FK + deletes collection |
| Non-owner's collection | `{ success: false }` |

**Total expected tests: ~8-10**

---

## Task 5: Integration Tests — `provenance.ts` (Show Records)

Create `src/app/actions/__tests__/provenance.test.ts`.

### Test: `addShowRecord`
| Scenario | Expected |
|----------|----------|
| Valid data with all fields | `{ success: true }` |
| Missing show name | `{ success: false }` |
| Unauthenticated | `{ success: false }` |
| Fuzzy date fallback (showDateText with year, no showDate) | Verify `show_date` = `YYYY-01-01` |
| Class name is sent and stored | Verify `class_name` in insert payload |

### Test: `updateShowRecord` (Notes Deletion Bug Regression)
| Scenario | Expected |
|----------|----------|
| Notes cleared (sent as null) | Verify `notes = null` in update payload |
| Notes changed to new value | Verify `notes = "new value"` in update payload |
| Field not sent (undefined) | Verify field is NOT in update payload |
| Class name updated | Verify `class_name` in update payload |

### Test: `savePedigree`
| Scenario | Expected |
|----------|----------|
| New pedigree (no existing) → insert | `{ success: true }` |
| Update existing pedigree → update | `{ success: true }` |
| Relational IDs (sireId/damId) saved | Verify `sire_id` / `dam_id` in payload |

**Total expected tests: ~12-14**

---

## PART 2: E2E Tests (Playwright)

### E2E Auth Helper

Create `e2e/helpers/auth.ts`:

```typescript
import { Page } from "@playwright/test";

export async function loginAs(page: Page, email: string, password: string) {
    await page.goto("/login");
    await page.fill('input[type="email"]', email);
    await page.fill('input[type="password"]', password);
    await page.click('button[type="submit"]');
    // Wait for redirect to dashboard
    await page.waitForURL("**/dashboard**", { timeout: 10000 });
}

export const USER_A = {
    email: process.env.TEST_USER_A_EMAIL || "testbot@example.com",
    password: process.env.TEST_USER_A_PASSWORD || "testpassword123",
};

export const USER_B = {
    email: process.env.TEST_USER_B_EMAIL || "testbot2@example.com",
    password: process.env.TEST_USER_B_PASSWORD || "testpassword123",
};
```

---

## Task 6: E2E — Auth Flow (`e2e/auth.spec.ts`)

```typescript
test.describe("Auth Flow", () => {
    test("login with valid credentials → dashboard", ...);
    test("login with invalid password → error message", ...);
    test("logout → redirects to login", ...);
    test("protected page redirects unauthenticated users", ...);
});
```

| Test | Steps |
|------|-------|
| Login success | Fill email/password → submit → expect URL = `/dashboard` |
| Login failure | Fill wrong password → expect error text visible |
| Logout | Login → click avatar/menu → logout → expect URL = `/login` |
| Auth guard | Visit `/dashboard` without login → expect redirect to `/login` |

---

## Task 7: E2E — Inventory Flow (`e2e/inventory.spec.ts`)

```typescript
test.describe("Inventory Flow", () => {
    test("add horse via quick add → appears on dashboard", ...);
    test("edit horse name → change persists", ...);
    test("delete horse → removed from dashboard", ...);
});
```

| Test | Steps |
|------|-------|
| Quick add | Login → `/add-horse/quick` → fill form → submit → verify toast/redirect → dashboard shows horse |
| Edit | Login → click horse → click "Edit" → change name → save → verify new name |
| Delete | Login → click horse → click delete → confirm → verify horse removed |

---

## Task 8: E2E — Show Entry Flow (`e2e/show-entry.spec.ts`)

```typescript
test.describe("Show Entry Flow", () => {
    test("add show record to horse → appears in timeline", ...);
    test("edit show record notes → can clear to empty", ...);
});
```

| Test | Steps |
|------|-------|
| Add record | Login → horse passport → "Add Record" → fill show name, class name, placing → save → verify in timeline |
| Clear notes | Login → edit existing record → clear notes → save → verify notes gone (regression test for the deletion bug) |

---

## Task 9: Flesh Out E2E Scaffolds

### `e2e/safe-trade.spec.ts` — Unskip tests

Remove `test.skip` from at least the first 2 tests and implement:

1. **Seller lists horse** — Login as User A → navigate to horse → set trade status to "For Sale" via edit page
2. **Buyer makes offer** — Login as User B → find the horse in Show Ring → click "Make Offer" or message → submit offer

> **Note:** The full 5-step flow (offer → accept → pay → verify → complete) requires careful state management between two accounts. Implement steps 1-2 as real tests; keep steps 3-5 as `test.skip` with improved TODO comments explaining the prerequisite state.

### `e2e/hoofprint-transfer.spec.ts` — Unskip first test

1. **Owner generates transfer code** — Login as User A → horse passport → click Transfer → verify 6-character code appears

> **Note:** Steps 2-3 (claim + ownership swap) require a second browser context. Mark as `test.fixme` with a comment explaining the multi-context requirement.

---

## Task 10: Playwright Perf Benchmark

Add to `e2e/smoke.spec.ts`:

```typescript
test("dashboard loads within 5 seconds", async ({ page }) => {
    // Login first
    await loginAs(page, USER_A.email, USER_A.password);
    
    const start = Date.now();
    await page.goto("/dashboard");
    await page.waitForSelector("[data-testid='stable-grid'], .dashboard-grid, .stable-empty", { timeout: 10000 });
    const loadTime = Date.now() - start;
    
    console.log(`Dashboard load time: ${loadTime}ms`);
    expect(loadTime).toBeLessThan(5000);
});
```

This baselines the dashboard load time. Not a hard failure — just a canary for regressions.

---

## Task 11: Verify and Report

### Step 1: Run full unit + integration suite
```
npm run test:unit
```

Expected: ~120+ tests passing (59 existing + ~60 new integration tests).

### Step 2: Run E2E (requires dev server)
```
npm run test:e2e
```

### Step 3: Run with coverage
```
npm run test:unit:coverage
```

### Step 4: Verify build
```
npx next build
```

### Step 5: Commit
```
git add -A
git commit -m "test: Test Sprint B — integration tests for 5 server actions, E2E auth/inventory/show-entry flows, perf benchmark"
```

---

# Expected Outcomes

After this sprint:
- **~120+ Vitest tests** (59 unit + ~60 integration) across 10 test files
- **~12 Playwright E2E tests** across 6 spec files (3 smoke + auth + inventory + show-entry + partial safe-trade + partial transfer)
- Commerce state machine transitions verified
- Transfer code generation + claim logic verified
- Notes deletion bug has a regression test
- Class Name field has integration test coverage
- Dashboard load time baselined
- Foundation ready for Test Sprint C (API routes, accessibility, coverage enforcement)
