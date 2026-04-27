import { test, expect } from "@playwright/test";

/**
 * V44 Visual QA — Phase 6: Mobile & Simple Mode Cross-Check
 *
 * Tests every Tier 1 page at 375×812 (iPhone SE) for:
 * - No horizontal overflow
 * - No console errors
 * - Simple Mode (130% text scale) doesn't break layout
 */

const TIER_1_PUBLIC = [
  { path: "/", label: "Landing" },
  { path: "/login", label: "Login" },
  { path: "/signup", label: "Signup" },
  { path: "/market", label: "Market" },
  { path: "/catalog", label: "Catalog" },
  { path: "/community", label: "Community" },
  { path: "/discover", label: "Discover" },
];

const TIER_1_AUTH = [
  { path: "/dashboard", label: "Dashboard" },
  { path: "/add-horse", label: "Add Horse" },
  { path: "/inbox", label: "Inbox" },
  { path: "/settings", label: "Settings" },
  { path: "/notifications", label: "Notifications" },
  { path: "/feed", label: "Feed" },
];

// ── Helpers ────────────────────────────────────────────────

async function assertNoHorizontalOverflow(page: import("@playwright/test").Page, label: string) {
  const overflow = await page.evaluate(() => ({
    scrollWidth: document.documentElement.scrollWidth,
    innerWidth: window.innerWidth,
  }));
  expect(
    overflow.scrollWidth,
    `${label}: scrollWidth (${overflow.scrollWidth}) > innerWidth (${overflow.innerWidth})`
  ).toBeLessThanOrEqual(overflow.innerWidth);
}

// ── Public Pages (375px) ──────────────────────────────────

test.describe("Mobile 375px — Public Pages", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  for (const { path, label } of TIER_1_PUBLIC) {
    test(`${label} — no overflow at 375px`, async ({ page }) => {
      const errors: string[] = [];
      page.on("pageerror", (err) => errors.push(err.message));

      await page.goto(path, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(600);

      await assertNoHorizontalOverflow(page, label);
      expect(errors, `${label}: console errors detected`).toHaveLength(0);
    });
  }
});

// ── Authenticated Pages (375px) ───────────────────────────

test.describe("Mobile 375px — Auth Pages", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  test.beforeEach(async ({ page }) => {
    if (!process.env.TEST_USER_A_EMAIL || !process.env.TEST_USER_A_PASSWORD) {
      test.skip(true, "TEST_USER_A credentials not configured");
      return;
    }
    await page.goto("/login");
    await page.fill('input[type="email"]', process.env.TEST_USER_A_EMAIL);
    await page.fill('input[type="password"]', process.env.TEST_USER_A_PASSWORD);
    await page.click('button[type="submit"]');
    await page.waitForURL("**/dashboard**", { timeout: 10000 });
  });

  for (const { path, label } of TIER_1_AUTH) {
    test(`${label} — no overflow at 375px`, async ({ page }) => {
      await page.goto(path, { waitUntil: "domcontentloaded" });
      await page.waitForTimeout(600);

      await assertNoHorizontalOverflow(page, label);
    });
  }
});

// ── Simple Mode (130% scale, 375px) ──────────────────────

test.describe("Simple Mode — 375px with 130% text", () => {
  test.use({ viewport: { width: 375, height: 812 } });

  for (const { path, label } of TIER_1_PUBLIC) {
    test(`${label} — Simple Mode no overflow`, async ({ page }) => {
      await page.goto(path, { waitUntil: "domcontentloaded" });

      // Enable Simple Mode by setting the data attribute directly
      await page.evaluate(() => {
        document.documentElement.setAttribute("data-simple-mode", "true");
      });
      await page.waitForTimeout(400);

      await assertNoHorizontalOverflow(page, `${label} [Simple Mode]`);
    });
  }
});
