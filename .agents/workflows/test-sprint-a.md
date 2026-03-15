---
description: Test Sprint A — Foundation. Vitest config, Supabase mock factory, unit tests for 5 utility files, Playwright E2E scaffold completion. First real test coverage for Model Horse Hub.
---

# Test Sprint A: Testing Foundation

> **Context:** The Comprehensive Test Suite Blueprint proposes a 6-phase enterprise testing plan. This workflow implements the **highest-ROI subset** — utility unit tests, E2E smoke validation, and a lightweight security linter — without the overhead of component tests, MSW, CI/CD, or cross-browser testing.
>
> **Pre-requisites:** V27 Stabilization Sprint complete (Playwright installed, 2 spec files scaffolded). Clean build.
>
> **Dependencies already installed:** `vitest` (in devDependencies), `@playwright/test` (added in V27)
>
> **Dependencies to install:** `@vitest/coverage-v8`, `eslint-plugin-security`

// turbo-all

---

## Developer Agent Rules

> **MANDATORY:** Run `npm run test:unit` after each task to verify all tests pass. Run `npx next build` at the end to ensure no regressions. Commit after each task.

---

## Task 0: Update README with Testing Setup

Before writing tests, add a "Testing" section to `README.md`:

```markdown
## Testing

### Unit Tests (Vitest)
```bash
npm run test:unit          # Single run
npm run test:unit:watch    # Watch mode for development
npm run test:unit:coverage # Run with coverage report
```

### E2E Tests (Playwright)
```bash
npm run test:e2e           # Headless Chromium
```

### Environment
Tests use a mocked Supabase client (no live DB connection required).
Set `NEXT_PUBLIC_SUPABASE_URL=https://test.supabase.co` in `.env.test` if needed.
```

---

## Task 1: Configure Vitest + Security Linter

### Step 1: Install dependencies

```
npm install --save-dev @vitest/coverage-v8 eslint-plugin-security
```

### Step 2: Create `vitest.config.ts` at project root

```typescript
import { defineConfig } from "vitest/config";
import path from "path";

export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
    exclude: ["node_modules", ".next", "e2e"],
    passWithNoTests: true,
    coverage: {
      provider: "v8",
      reporter: ["text", "html"],
      include: ["src/lib/**/*.ts"],
      exclude: ["src/lib/types/**", "src/lib/supabase/**"],
      thresholds: {
        lines: 50,
        functions: 50,
        branches: 50,
        statements: 50,
      },
    },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
```

> **Note:** `passWithNoTests: true` prevents CI failure when files have no test coverage yet. Ratchet to `false` in Sprint C.

### Step 3: Update `package.json` scripts

Add these scripts (keep existing ones):
```json
"test:unit": "vitest run",
"test:unit:watch": "vitest",
"test:unit:coverage": "vitest run --coverage",
"test:e2e": "npx playwright test"
```

### Step 4: Add `eslint-plugin-security` to ESLint config

In `eslint.config.mjs`, add the security plugin. This catches low-hanging XSS/injection patterns without full OWASP scans:

```javascript
import security from "eslint-plugin-security";
// ... existing config ...
// Add security.configs.recommended to the extends array or plugin list
```

> **Note:** Review and disable any noisy rules (e.g., `detect-object-injection` can be overly aggressive). Use `eslint-plugin-security/recommended` as a starting point.

### Step 5: Create Supabase mock factory

Create `src/__tests__/mocks/supabase.ts`:

```typescript
import { vi } from "vitest";

/**
 * Creates a mock Supabase client for unit/integration tests.
 * Chain methods return `this` for fluent API compatibility.
 *
 * Usage:
 *   const mock = createMockSupabaseClient();
 *   mock._mockQuery.select.mockResolvedValueOnce({ data: [...], error: null });
 */
export function createMockSupabaseClient(overrides: Record<string, unknown> = {}) {
  const mockQuery = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    upsert: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    is: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    or: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    range: vi.fn().mockReturnThis(),
    single: vi.fn().mockResolvedValue({ data: null, error: null }),
    maybeSingle: vi.fn().mockResolvedValue({ data: null, error: null }),
    then: undefined, // Prevent auto-await
    data: null,
    error: null,
    ...overrides,
  };

  return {
    from: vi.fn(() => mockQuery),
    auth: {
      getUser: vi.fn().mockResolvedValue({
        data: { user: { id: "test-user-id", email: "test@example.com" } },
      }),
      signUp: vi.fn().mockResolvedValue({ data: {}, error: null }),
      signInWithPassword: vi.fn().mockResolvedValue({ data: {}, error: null }),
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: { path: "test/path.webp" }, error: null }),
        remove: vi.fn().mockResolvedValue({ data: [], error: null }),
        getPublicUrl: vi.fn().mockReturnValue({ data: { publicUrl: "https://test.supabase.co/storage/v1/object/public/horse-images/test/path.webp" } }),
      })),
    },
    _mockQuery: mockQuery, // Expose for per-test assertions
  };
}

/**
 * Creates a mock admin client (bypasses RLS).
 * Same interface as above but represents the service-role client.
 * Used in tests for cross-user operations (notifications, transfers, etc.)
 */
export function createMockAdminClient(overrides: Record<string, unknown> = {}) {
  const client = createMockSupabaseClient(overrides);
  // Admin client is identical in shape — the difference is RLS bypass,
  // which doesn't apply in mocked tests. This function exists so tests
  // can mock `getAdminClient()` with a semantically-correct factory.
  return client;
}
```

### Step 6: Verify

```
npm run test:unit
```

Should run the existing `smoke.test.ts` and pass.

---

## Task 2: Unit Tests — `mentions.ts`

Create `src/lib/utils/__tests__/mentions.test.ts`:

Test the `extractMentions()` function with these cases:

| Input | Expected Output |
|-------|----------------|
| `"Hello @Alice"` | `["Alice"]` |
| `"@Bob and @Charlie"` | `["Bob", "Charlie"]` |
| `'@"John Smith"'` | `["John Smith"]` |
| `"@Multi Word Name rest of text"` | Should include `"Multi Word Name"` (greedy up to 5 words) |
| `"No mentions here"` | `[]` |
| `""` (empty) | `[]` |
| `"@@double"` | Test edge case — verify behavior |
| `"@ab"` (too short, <3 chars) | `[]` or verify minimum length handling |
| `"@ValidAlias123"` | `["ValidAlias123"]` |
| `"Start @Alice end @Bob."` | `["Alice", "Bob"]` |

Import and test:
```typescript
import { extractMentions } from "@/lib/utils/mentions";
```

> **Tip:** Read the current regex in `mentions.ts` first to understand what it captures. The recent V30 update added multi-word greedy matching.

---

## Task 3: Unit Tests — `validation.ts`

Create `src/lib/utils/__tests__/validation.test.ts`:

Test existing functions + the new `sanitizeText()` / `sanitizeRichText()` (added in V27):

**`getRequiredString()` tests:**
| Input | Expected |
|-------|----------|
| FormData with `key="hello"` | `"hello"` |
| FormData with `key=""` | `null` |
| FormData with `key="null"` | `null` |
| FormData with `key="undefined"` | `null` |
| FormData with missing key | `null` |
| FormData with `key="  spaces  "` | `"spaces"` (trimmed) |

**`getOptionalNumber()` tests:**
| Input | Expected |
|-------|----------|
| FormData with `key="42.5"` | `42.5` |
| FormData with `key="abc"` | `null` |
| FormData with missing key | `null` |

**`getBoolean()` tests:**
| Input | Expected |
|-------|----------|
| FormData with `key="true"` | `true` |
| FormData with `key="false"` | `false` |
| FormData with missing key, default `true` | `true` |

**`sanitizeText()` tests (if present after V27):**
| Input | Expected |
|-------|----------|
| `"Normal text"` | `"Normal text"` |
| `"<script>alert('xss')</script>"` | `""` or `"alert('xss')"` (tags stripped) |
| `"Hello <b>bold</b>"` | `"Hello bold"` |
| `"<img src=x onerror=alert(1)>"` | `""` |
| `"Multi\nline"` | `"Multi\nline"` (preserved) |

**`sanitizeRichText()` tests (if present after V27):**
| Input | Expected |
|-------|----------|
| `"<b>bold</b> <i>italic</i>"` | Preserved (allowed tags) |
| `"<script>bad</script>"` | Stripped |
| `'<a href="https://safe.com">link</a>'` | Preserved |
| `'<a href="javascript:void(0)">bad</a>'` | `href` stripped (disallowed scheme) |

> **Note:** If `sanitizeText` / `sanitizeRichText` don't exist yet (V27 incomplete), write the tests with `test.skip()` and add a `// TODO: unskip after V27 Task 2.1` marker.

---

## Task 4: Unit Tests — `storage.ts`

Create `src/lib/utils/__tests__/storage.test.ts`:

Test `extractStoragePath()`:

| Input | Expected |
|-------|----------|
| `"horses/abc/thumb.webp"` | `"horses/abc/thumb.webp"` (passthrough) |
| `"https://xxx.supabase.co/storage/v1/object/public/horse-images/horses/abc/thumb.webp"` | `"horses/abc/thumb.webp"` |
| `"https://xxx.supabase.co/storage/v1/object/sign/horse-images/horses/abc/thumb.webp?token=xxx"` | `"horses/abc/thumb.webp"` |
| `""` (empty) | `""` |

Test `getPublicImageUrl()` (after V27 refactors storage.ts):
| Input | Expected |
|-------|----------|
| `"horses/abc/thumb.webp"` | Contains `"/storage/v1/object/public/horse-images/horses/abc/thumb.webp"` |

Test `getPublicImageUrls()`:
| Input | Expected |
|-------|----------|
| `["path1.webp", "path2.webp"]` | Map with 2 entries, keys = inputs, values = public URLs |
| `[]` | Empty Map |

> **Setup:** Set `NEXT_PUBLIC_SUPABASE_URL` via `vi.stubEnv("NEXT_PUBLIC_SUPABASE_URL", "https://test.supabase.co")` in a `beforeEach`.

---

## Task 5: Unit Tests — `rateLimit.ts`

Create `src/lib/utils/__tests__/rateLimit.test.ts`:

Read the current `rateLimit.ts` implementation first, then test:

| Scenario | Expected |
|----------|----------|
| First call within limit | Allowed |
| Calls at limit | Allowed |
| Call exceeding limit | Rejected / returns rate-limited response |
| After cooldown period | Allowed again |

> **Setup:** Use `vi.useFakeTimers()` and `vi.advanceTimersByTime()` to simulate time passage for cooldown window tests.

---

## Task 6: Playwright E2E Smoke Test

Create `e2e/smoke.spec.ts` — a basic smoke test that validates the Playwright setup works end-to-end:

```typescript
import { test, expect } from "@playwright/test";

test.describe("Smoke Tests", () => {
  test("landing page loads and has correct title", async ({ page }) => {
    await page.goto("/");
    await expect(page).toHaveTitle(/Model Horse Hub/i);
  });

  test("login page is accessible", async ({ page }) => {
    await page.goto("/login");
    await expect(page.locator("text=Sign In").or(page.locator("text=Log In"))).toBeVisible();
  });

  test("community Show Ring loads without auth", async ({ page }) => {
    await page.goto("/community");
    // Should render the public Show Ring page without requiring login
    await expect(page.locator("body")).not.toContainText("Error");
  });
});
```

> **Purpose:** This validates the Playwright config, web server startup, and basic routing before Sprint B writes full flow tests.

### Verify E2E setup works:
```
npm run test:e2e
```

> **Note:** This requires `npm run dev` running (or Playwright's `webServer` config to auto-start it). If the dev server isn't running, the test will fail — that's expected. The developer agent should ensure the Playwright config from V27 has the `webServer` block configured.

---

## Task 7: Verify and Report

### Step 1: Run full unit suite
```
npm run test:unit
```

### Step 2: Run with coverage
```
npm run test:unit:coverage
```

### Step 3: Verify build
```
npx next build
```

### Step 4: Commit
```
git add -A
git commit -m "test: Test Sprint A — vitest config, mock factory, security linter, unit tests for mentions/validation/storage/rateLimit, E2E smoke"
```

---

# Expected Outcomes

After this sprint:
- `vitest.config.ts` configured with path aliases, coverage, and `passWithNoTests`
- Supabase mock factory (standard + admin) ready for Sprint B integration tests
- `eslint-plugin-security` catching low-hanging XSS/injection patterns
- ~30-35 unit tests across 4 utility files
- 3 Playwright E2E smoke tests validating the setup
- All tests pass via `npm run test:unit`
- Coverage report generated via `npm run test:unit:coverage`
- README updated with testing instructions
- Foundation ready for Test Sprint B (integration tests + full E2E flows)
