---
description: Automated Device Diagnostics — Playwright iPhone 12 / Pixel 5 / iPad viewport overflow detection, baseline audit for mobile UX regressions
---

# 071 — Automated Device Diagnostics (The Playwright Matrix)

> **Purpose:** Establish an automated, repeatable test suite that mathematically proves zero horizontal overflow exists on every critical page across **three device viewports**: iPhone 12 (iOS Safari), Pixel 5 (Android Chrome), and iPad (tablet Safari).
> **Depends On:** Nothing — this is the diagnostic baseline that runs FIRST.
> **Output:** A Playwright multi-device project config + a new E2E spec file that catches overflow regressions across the full device spectrum.

// turbo-all

---

## Task 1: Add the 3-Device Matrix to Playwright Config

**File:** `playwright.config.ts`

### 1.1 Update the config

Replace the current `defineConfig` export with a version that includes the existing desktop default AND three mobile/tablet projects using Playwright's built-in device presets.

**Current state (line 23–36):**
```ts
export default defineConfig({
    testDir: "./e2e",
    timeout: 30000,
    retries: 0,
    use: {
        baseURL: "http://localhost:3000",
        headless: true,
    },
    webServer: {
        command: "npm run dev",
        port: 3000,
        reuseExistingServer: true,
    },
});
```

**Target state:**
```ts
import { devices } from "@playwright/test";

export default defineConfig({
    testDir: "./e2e",
    timeout: 30000,
    retries: 0,
    projects: [
        {
            name: "Desktop Chrome",
            use: {
                baseURL: "http://localhost:3000",
                headless: true,
            },
        },
        {
            name: "Mobile Safari",
            use: {
                ...devices["iPhone 12"],
                baseURL: "http://localhost:3000",
                headless: true,
            },
        },
        {
            name: "Mobile Chrome",
            use: {
                ...devices["Pixel 5"],
                baseURL: "http://localhost:3000",
                headless: true,
            },
        },
        {
            name: "Tablet",
            use: {
                ...devices["iPad (gen 7)"],
                baseURL: "http://localhost:3000",
                headless: true,
            },
        },
    ],
    webServer: {
        command: "npm run dev",
        port: 3000,
        reuseExistingServer: true,
    },
});
```

**Device preset details:**

| Project | Device Preset | Viewport | Touch | User-Agent |
|---------|--------------|----------|-------|------------|
| `Mobile Safari` | `iPhone 12` | 390×844 | ✅ | iOS Safari |
| `Mobile Chrome` | `Pixel 5` | 393×851 | ✅ | Android Chrome |
| `Tablet` | `iPad (gen 7)` | 810×1080 | ✅ | iPad Safari |

> **Note:** Playwright uses `iPad (gen 7)` (not "gen 8") as the built-in preset name. Verify with `npx playwright devices` if needed.

**Key detail:** Import `devices` from `@playwright/test` at the top of the file.

### 1.2 Verify existing tests still pass on Desktop Chrome

```powershell
cmd /c "npx playwright test e2e/smoke.spec.ts --project='Desktop Chrome' 2>&1"
```

### Validation Checklist
- [ ] `devices` is imported from `@playwright/test`
- [ ] Four projects exist: `Desktop Chrome`, `Mobile Safari`, `Mobile Chrome`, `Tablet`
- [ ] `baseURL` and `headless` are set in all projects
- [ ] Existing smoke tests pass on `Desktop Chrome` project
- [ ] `npx next build` succeeds with 0 errors

---

## Task 2: Write the Multi-Device Overflow Detection Test

**File:** `e2e/device-layout.spec.ts` (NEW FILE)

### 2.1 Create the test file

This test loops through the most critical pages and asserts that no horizontal scrollbar exists on ANY device — i.e., `document.documentElement.scrollWidth <= window.innerWidth`. The same test file runs across all 3 device projects automatically via the Playwright config matrix.

```ts
import { test, expect } from "@playwright/test";

/**
 * Multi-Device Layout Overflow Test Suite
 *
 * Asserts that no page produces horizontal overflow when rendered
 * across the full device matrix:
 *   - iPhone 12  (390×844)  — iOS Safari
 *   - Pixel 5    (393×851)  — Android Chrome
 *   - iPad gen 7 (810×1080) — Tablet Safari
 *
 * Any page where scrollWidth > innerWidth has a CSS bug
 * causing horizontal scrolling on that device class.
 */

const CRITICAL_PAGES = [
    { path: "/", label: "Landing Page" },
    { path: "/login", label: "Login" },
    { path: "/signup", label: "Signup" },
    { path: "/shows", label: "Shows List" },
    { path: "/market", label: "Blue Book Market" },
    { path: "/community", label: "Community Hub" },
    { path: "/studio", label: "Art Studio" },
    { path: "/discover", label: "Discover Collectors" },
    { path: "/about", label: "About" },
    { path: "/faq", label: "FAQ" },
];

// Pages that require authentication — test only if test accounts are configured
const AUTH_PAGES = [
    { path: "/dashboard", label: "Dashboard" },
    { path: "/feed", label: "Activity Feed" },
    { path: "/inbox", label: "Inbox" },
    { path: "/settings", label: "Settings" },
    { path: "/shows/planner", label: "Live Show Packer" },
];

for (const { path, label } of CRITICAL_PAGES) {
    test(`No horizontal overflow on ${label} (${path})`, async ({ page }) => {
        await page.goto(path, { waitUntil: "networkidle" });

        // Wait for any Framer Motion entrance animations to complete
        await page.waitForTimeout(500);

        const overflow = await page.evaluate(() => {
            return {
                scrollWidth: document.documentElement.scrollWidth,
                innerWidth: window.innerWidth,
                bodyScrollWidth: document.body.scrollWidth,
            };
        });

        expect(
            overflow.scrollWidth,
            `${label}: scrollWidth (${overflow.scrollWidth}) should be ≤ innerWidth (${overflow.innerWidth})`
        ).toBeLessThanOrEqual(overflow.innerWidth);
    });
}

// Auth page tests — only run if TEST_USER_A credentials exist
const hasTestCreds = !!process.env.TEST_USER_A_EMAIL;
const authTest = hasTestCreds ? test : test.skip;

authTest.describe("Authenticated pages", () => {
    authTest.beforeEach(async ({ page }) => {
        // Login via Supabase auth
        await page.goto("/login");
        await page.fill('input[type="email"]', process.env.TEST_USER_A_EMAIL!);
        await page.fill('input[type="password"]', process.env.TEST_USER_A_PASSWORD!);
        await page.click('button[type="submit"]');
        await page.waitForURL("**/dashboard**", { timeout: 10000 });
    });

    for (const { path, label } of AUTH_PAGES) {
        authTest(`No horizontal overflow on ${label} (${path})`, async ({ page }) => {
            await page.goto(path, { waitUntil: "networkidle" });
            await page.waitForTimeout(500);

            const overflow = await page.evaluate(() => ({
                scrollWidth: document.documentElement.scrollWidth,
                innerWidth: window.innerWidth,
            }));

            expect(
                overflow.scrollWidth,
                `${label}: scrollWidth (${overflow.scrollWidth}) should be ≤ innerWidth (${overflow.innerWidth})`
            ).toBeLessThanOrEqual(overflow.innerWidth);
        });
    }
});
```

### 2.2 Run the baseline audit across ALL devices (expect failures)

Run against the full device matrix:

```powershell
cmd /c "npx playwright test e2e/device-layout.spec.ts 2>&1"
```

Or target a specific device class:

```powershell
# iOS only
cmd /c "npx playwright test e2e/device-layout.spec.ts --project='Mobile Safari' 2>&1"

# Android only
cmd /c "npx playwright test e2e/device-layout.spec.ts --project='Mobile Chrome' 2>&1"

# Tablet only
cmd /c "npx playwright test e2e/device-layout.spec.ts --project='Tablet' 2>&1"
```

This will produce a **per-device list of failing pages**. Record the failures — they become the hit-list for Document 3 (073).

### Validation Checklist
- [ ] `e2e/device-layout.spec.ts` exists and is syntactically valid
- [ ] Test runs against all 3 device projects when no `--project` is specified
- [ ] Public pages test without authentication
- [ ] Auth pages gracefully skip if `TEST_USER_A_EMAIL` is not set
- [ ] Baseline results are recorded per device (list of passing/failing pages × device)
- [ ] `npx next build` succeeds with 0 errors

---

## Task 3: Add npm Script Shortcuts

**File:** `package.json`

### 3.1 Add convenience scripts

Add to the `"scripts"` section:

```json
"test:devices": "npx playwright test e2e/device-layout.spec.ts",
"test:iphone": "npx playwright test e2e/device-layout.spec.ts --project='Mobile Safari'",
"test:pixel": "npx playwright test e2e/device-layout.spec.ts --project='Mobile Chrome'",
"test:ipad": "npx playwright test e2e/device-layout.spec.ts --project='Tablet'"
```

This allows running the full matrix or targeting a single device class:

| Command | What it tests |
|---------|--------------|
| `npm run test:devices` | All 3 devices × all pages |
| `npm run test:iphone` | iPhone 12 (390×844) only |
| `npm run test:pixel` | Pixel 5 (393×851) only |
| `npm run test:ipad` | iPad (810×1080) only |

### Validation Checklist
- [ ] `npm run test:devices` runs the overflow tests across all 3 devices
- [ ] `npm run test:iphone` runs only the iPhone project
- [ ] Existing `test:e2e` script still works for desktop + all device tests

---

## Task 4: Update References in Other Workflows

### 4.1 Cross-references to update

The other 3 workflow files (072, 073, 074) reference the test command. Verify they use the new names:

| Workflow | Old Reference | New Reference |
|----------|--------------|---------------|
| `073-mobile-macro-layouts.md` | `npm run test:mobile` | `npm run test:devices` |
| `074-mobile-components-touch.md` | `npm run test:mobile` | `npm run test:devices` |

### 4.2 Update the verification gates

In workflows 073 and 074, the human verification gates should instruct running:

```powershell
cmd /c "npx playwright test e2e/device-layout.spec.ts 2>&1"
```

---

## 🛑 HUMAN VERIFICATION GATE 🛑

**Stop execution. Print the baseline audit results per device. Await human input.**

Report format:
```
DEVICE OVERFLOW AUDIT RESULTS
==============================

📱 iPhone 12 (390×844 — Mobile Safari):
  ✅ PASS: /login — scrollWidth: 390
  ✅ PASS: /signup — scrollWidth: 390
  ❌ FAIL: /dashboard — scrollWidth: 812 (overflow: 422px)
  ❌ FAIL: /market — scrollWidth: 640 (overflow: 250px)

📱 Pixel 5 (393×851 — Mobile Chrome):
  ✅ PASS: /login — scrollWidth: 393
  ❌ FAIL: /dashboard — scrollWidth: 812 (overflow: 419px)
  ❌ FAIL: /market — scrollWidth: 640 (overflow: 247px)

📱 iPad (810×1080 — Tablet Safari):
  ✅ PASS: /login — scrollWidth: 810
  ✅ PASS: /dashboard — scrollWidth: 810
  ❌ FAIL: /market — scrollWidth: 940 (overflow: 130px)

SUMMARY: 24/30 pass  |  6 failures across 3 devices
```

The failing pages feed directly into `073-mobile-macro-layouts.md` as the fix target list.

---

## Build Gate

Run `npx next build` (via `cmd /c "npx next build 2>&1"`) and confirm 0 errors before marking complete.
