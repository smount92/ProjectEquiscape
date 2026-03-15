---
description: Test Sprint A — Foundation. Vitest config, Supabase mock factory, unit tests for 5 utility files, Playwright E2E scaffold completion. First real test coverage for Model Horse Hub.
---

# Test Sprint A: Testing Foundation

> **Context:** The Comprehensive Test Suite Blueprint proposes a 6-phase enterprise testing plan. This workflow implements the **highest-ROI subset** — utility unit tests and E2E scaffolding — without the overhead of component tests, MSW, CI/CD, or cross-browser testing.
>
> **Pre-requisites:** V27 Stabilization Sprint complete (Playwright installed, 2 spec files scaffolded). Clean build.
>
> **Dependencies already installed:** `vitest` (in devDependencies), `@playwright/test` (added in V27)
>
> **Dependencies to install:** `@vitest/coverage-v8` (coverage reporting)

// turbo-all

---

## Developer Agent Rules

> **MANDATORY:** Run `npm run test:unit` after each task to verify all tests pass. Run `npx next build` at the end to ensure no regressions. Commit after each task.

---

## Task 1: Configure Vitest

### Step 1: Install coverage provider

```
npm install --save-dev @vitest/coverage-v8
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

### Step 3: Update `package.json` scripts

Add these scripts (keep existing ones):
```json
"test:unit": "vitest run",
"test:unit:watch": "vitest",
"test:unit:coverage": "vitest run --coverage",
"test:e2e": "npx playwright test"
```

### Step 4: Create Supabase mock factory

Create `src/__tests__/mocks/supabase.ts`:

```typescript
import { vi } from "vitest";

/**
 * Creates a mock Supabase client for unit/integration tests.
 * Chain methods return `this` for fluent API compatibility.
 */
export function createMockSupabaseClient(overrides: Record<string, unknown> = {}) {
  const mockQuery = {
    select: vi.fn().mockReturnThis(),
    insert: vi.fn().mockReturnThis(),
    update: vi.fn().mockReturnThis(),
    delete: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    neq: vi.fn().mockReturnThis(),
    in: vi.fn().mockReturnThis(),
    ilike: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
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
    },
    storage: {
      from: vi.fn(() => ({
        upload: vi.fn().mockResolvedValue({ data: { path: "test/path.webp" }, error: null }),
        createSignedUrl: vi.fn().mockResolvedValue({ data: { signedUrl: "https://signed.url" }, error: null }),
        createSignedUrls: vi.fn().mockResolvedValue({ data: [], error: null }),
      })),
    },
    _mockQuery: mockQuery, // Expose for assertions
  };
}
```

### Step 5: Verify

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
| `"@@double"` | Test edge case |
| `"@ab"` (too short, <3 chars) | `[]` |
| `"@ValidAlias123"` | `["ValidAlias123"]` |
| `"Start @Alice end @Bob."` | `["Alice", "Bob"]` |

Import and test:
```typescript
import { extractMentions } from "@/lib/utils/mentions";
```

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

> **Note:** If `sanitizeText` / `sanitizeRichText` don't exist yet (V27 not complete), write the tests with `test.skip()` and add a TODO marker.

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
| `["path1.webp", "path2.webp"]` | Map with 2 entries |
| `[]` | Empty Map |

> **Note:** Set `NEXT_PUBLIC_SUPABASE_URL` in the test setup via `vi.stubEnv()` or `process.env`.

---

## Task 5: Unit Tests — `rateLimit.ts`

Create `src/lib/utils/__tests__/rateLimit.test.ts`:

Read the current `rateLimit.ts` implementation first, then test:

| Scenario | Expected |
|----------|----------|
| First call within limit | Allowed |
| Calls at limit | Allowed |
| Calls exceeding limit | Rejected / returns rate-limited response |
| After cooldown period | Allowed again |

> **Note:** Rate limiting may depend on `Date.now()` — mock it with `vi.useFakeTimers()`.

---

## Task 6: Verify and Report

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
git commit -m "test: Test Sprint A — vitest config, Supabase mock factory, unit tests for mentions/validation/storage/rateLimit"
```

---

# Expected Outcomes

After this sprint:
- `vitest.config.ts` configured with path aliases and coverage
- Supabase mock factory ready for integration tests
- ~25-30 unit tests across 4 utility files
- All tests pass via `npm run test:unit`
- Coverage report generated via `npm run test:unit:coverage`
- Foundation ready for Test Sprint B (integration tests)
