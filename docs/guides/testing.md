# Testing Guide

Model Horse Hub uses a two-layer testing strategy: **Vitest** for unit/integration tests and **Playwright** for E2E tests.

## Test Stack

| Tool | Version | Purpose |
|------|---------|---------|
| **Vitest** | 4.x | Unit & integration testing |
| **@vitest/coverage-v8** | 4.x | Code coverage |
| **@testing-library/react** | 16.x | Component testing (React Testing Library) |
| **@testing-library/jest-dom** | 6.x | Custom DOM matchers |
| **@testing-library/user-event** | 14.x | User interaction simulation |
| **Playwright** | 1.58+ | End-to-end browser testing |
| **@axe-core/playwright** | 4.x | Accessibility testing |

## Commands

```bash
# Unit tests (single run)
npm run test

# Unit tests (watch mode — re-runs on file changes)
npm run test:unit:watch

# Unit tests with coverage report
npm run test:unit:coverage

# Component tests only (React Testing Library)
npm run test:components

# E2E tests (all specs)
npm run test:e2e

# E2E tests (specific file)
npx playwright test e2e/auth.spec.ts

# E2E tests (headed mode — watch the browser)
npx playwright test --headed

# E2E tests (debug mode — step through)
npx playwright test --debug
```

## Unit Tests (Vitest)

### File Location

Unit tests go in `__tests__/` directories alongside the code they test:

```
src/
├── app/actions/
│   └── __tests__/
│       └── transactions.test.ts
├── lib/utils/
│   └── __tests__/
│       └── rateLimit.test.ts
├── components/
│   └── __tests__/
│       ├── setup.ts                  ← Common mocks (Next.js, Supabase)
│       ├── PhotoLightbox.test.tsx
│       ├── TrophyCase.test.tsx
│       ├── MarketFilters.test.tsx
│       ├── MakeOfferModal.test.tsx
│       └── HoofprintTimeline.test.tsx
```

### Writing a Unit Test

```typescript
import { describe, it, expect, vi, beforeEach } from "vitest";

describe("myFunction", () => {
    beforeEach(() => {
        vi.clearAllMocks();
    });

    it("should return success when input is valid", () => {
        const result = myFunction({ valid: true });
        expect(result.success).toBe(true);
    });

    it("should return error when input is invalid", () => {
        const result = myFunction({ valid: false });
        expect(result.success).toBe(false);
        expect(result.error).toBeDefined();
    });
});
```

### Mocking Next.js Server APIs

Server actions often use `after()` (from `next/server`) and `revalidatePath()` (from `next/cache`). These must be mocked in test files:

```typescript
vi.mock("next/cache", () => ({
    revalidatePath: vi.fn(),
    revalidateTag: vi.fn(),
}));
vi.mock("next/server", () => ({
    after: vi.fn((fn: () => void) => { /* no-op in tests */ }),
}));
```

### Mocking Supabase

Most server actions need the Supabase client mocked:

```typescript
vi.mock("@/lib/supabase/server", () => ({
    createClient: vi.fn(() => ({
        from: vi.fn(() => ({
            select: vi.fn().mockReturnThis(),
            insert: vi.fn().mockReturnThis(),
            eq: vi.fn().mockReturnThis(),
            single: vi.fn().mockResolvedValue({ data: mockData, error: null }),
        })),
        auth: {
            getUser: vi.fn().mockResolvedValue({
                data: { user: { id: "test-user-id" } },
                error: null,
            }),
        },
    })),
}));
```

## Component Tests (React Testing Library)

### Environment

Component tests run in `jsdom`. Add the environment annotation at the top of each test file:

```typescript
// @vitest-environment jsdom
```

### Setup File

The setup file at `src/components/__tests__/setup.ts` provides common mocks:
- `@testing-library/jest-dom/vitest` matchers (`.toBeInTheDocument()`, `.toHaveAttribute()`, etc.)
- Next.js navigation mocks (`useRouter`, `usePathname`, `useSearchParams`, `Link`)
- Supabase client/server mocks

### Writing a Component Test

```typescript
// @vitest-environment jsdom
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import MyComponent from "../MyComponent";

// Mock portal-based components
vi.mock("react-dom", async () => {
    const actual = await vi.importActual<typeof import("react-dom")>("react-dom");
    return { ...actual, createPortal: (node: React.ReactNode) => node };
});

describe("MyComponent", () => {
    it("renders correctly", () => {
        render(<MyComponent prop="value" />);
        expect(screen.getByText("Expected Text")).toBeInTheDocument();
    });

    it("handles user interaction", async () => {
        const user = userEvent.setup();
        render(<MyComponent prop="value" />);
        await user.click(screen.getByText("Click Me"));
        expect(screen.getByText("Clicked!")).toBeInTheDocument();
    });
});
```

### Tested Components (58 tests)

| Component | Tests | Coverage Highlights |
|-----------|-------|-------------------|
| **PhotoLightbox** | 15 | Keyboard nav, portal rendering, body scroll lock, single-image mode |
| **TrophyCase** | 9 | Empty state, category grouping, sort order, tier classes, tooltips |
| **MarketFilters** | 10 | Filter controls, URL param updates, dropdowns, a11y IDs |
| **MakeOfferModal** | 11 | Form validation, payment safety warnings, offer submission |
| **HoofprintTimeline** | 13 | Timeline events, ownership chain, add note form, stage selector |

## E2E Tests (Playwright)

### File Location

All E2E tests live in the `e2e/` directory:

```
e2e/
├── accessibility.spec.ts    # Axe accessibility scans
├── auth.spec.ts             # Login, signup, password reset
├── hoofprint-transfer.spec.ts # Transfer code generation and claim
├── inventory.spec.ts        # Add/edit/delete horses
├── safe-trade.spec.ts       # Commerce state machine flows
├── show-entry.spec.ts       # Show entry and voting
└── smoke.spec.ts            # Basic page load checks
```

### Test Accounts

E2E tests require two test accounts configured in `.env.local`:

```
# Test Account A (typically "seller" or "owner")
TEST_EMAIL_A=<your-test-email-a>
TEST_PASSWORD_A=<your-test-password-a>

# Test Account B (typically "buyer" or "recipient")
TEST_EMAIL_B=<your-test-email-b>
TEST_PASSWORD_B=<your-test-password-b>
```

See [Test Accounts](../getting-started/test-accounts.md) for full setup instructions.

### Writing an E2E Test

```typescript
import { test, expect } from "@playwright/test";

test.describe("My Feature", () => {
    test.beforeEach(async ({ page }) => {
        // Login as test user A
        await page.goto("/login");
        await page.fill('input[name="email"]', process.env.TEST_EMAIL_A!);
        await page.fill('input[name="password"]', process.env.TEST_PASSWORD_A!);
        await page.click('button[type="submit"]');
        await page.waitForURL("/dashboard");
    });

    test("user can create an item", async ({ page }) => {
        await page.goto("/my-feature");
        await page.click("text=Create New");
        await page.fill('input[name="title"]', "Test Item");
        await page.click("text=Submit");
        
        // Assert the item appears
        await expect(page.locator("text=Test Item")).toBeVisible();
    });
});
```

### Accessibility Testing

The `accessibility.spec.ts` uses `@axe-core/playwright` to scan pages:

```typescript
import AxeBuilder from "@axe-core/playwright";

test("page should have no accessibility violations", async ({ page }) => {
    await page.goto("/dashboard");
    const results = await new AxeBuilder({ page }).analyze();
    expect(results.violations).toEqual([]);
});
```

## Test Strategy

### What to Test

| Layer | What to Test | How |
|-------|-------------|-----|
| **Server Actions** | Business logic, validation, error cases | Vitest with mocked Supabase |
| **Utilities** | Pure functions, edge cases | Vitest |
| **UI Components** | Rendering, interactions, accessibility | Vitest + React Testing Library |
| **Critical Flows** | Auth, commerce, transfers | Playwright E2E |
| **Accessibility** | WCAG compliance | Playwright + axe-core |
| **Smoke** | Pages load without errors | Playwright |

### What Not to Test

- Supabase internals (RLS policies are tested manually in SQL Editor)
- Next.js framework behavior (routing, SSR)
- UI styling (visual regressions)

## CI / Build Verification

### GitHub Actions

A CI pipeline (`.github/workflows/ci.yml`) runs automatically on every push to `main` or `quality-sprint-*` branches, and on every PR to `main`:

1. **Checkout** → **Node.js 20 setup** → **npm ci**
2. **Lint** (advisory — `continue-on-error`)
3. **Build** (`npm run build`)
4. **Unit + Component Tests** (`npx vitest run`)
5. **Upload test artifacts** (14-day retention)

### Local Verification

Always run before committing:

```bash
npm run build && npm run test
```

The `npm run build` step catches:
- TypeScript type errors
- Missing imports
- Server/client boundary violations
- Dead code (unused exports)

---

**Next:** [Adding a Feature](adding-a-feature.md) · [Deployment](deployment.md)
