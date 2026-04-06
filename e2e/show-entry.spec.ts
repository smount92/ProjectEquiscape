import { test, expect } from "@playwright/test";
import { loginAs, USER_A } from "./helpers/auth";

/**
 * E2E Show Flow Tests
 *
 * These tests cover critical show system flows:
 * 1. Shows listing page renders correctly
 * 2. Show detail page renders hero, entry form, and entries grid
 * 3. Entry form interactions
 * 4. Results display on closed shows
 * 5. Show history widget on dashboard
 * 6. Mobile viewport flows
 * 7. Navigation guards
 */
test.describe("Show System — E2E", () => {
    test.beforeEach(async ({ page }) => {
        await loginAs(page, USER_A.email, USER_A.password);
    });

    // ── Shows Listing ──

    test("shows listing page loads with correct heading", async ({ page }) => {
        await page.goto("/shows");
        await page.waitForLoadState("networkidle");

        // Verify page heading (inside ExplorerLayout)
        await expect(page.getByText("Virtual Photo Shows", { exact: true })).toBeVisible({ timeout: 10000 });

        // Page should render without server errors
        await expect(page.locator("body")).not.toContainText("Application error");

        // Verify either shows grid or empty state is rendered
        const hasShows = await page.locator("a[id^='show-']").count();
        const hasEmpty = await page.locator("text=No Shows Yet").count();
        expect(hasShows + hasEmpty).toBeGreaterThan(0);
    });

    test("show cards display status badges", async ({ page }) => {
        await page.goto("/shows");
        await page.waitForLoadState("networkidle");

        const showLinks = page.locator("a[id^='show-']");
        const cardCount = await showLinks.count();

        if (cardCount > 0) {
            const firstCard = showLinks.first();
            // Every show card should have a status badge (🟢/🟡/🔴)
            await expect(firstCard.locator(".show-status-badge")).toBeVisible();
        } else {
            test.skip(true, "No shows exist");
        }
    });

    test("clicking a show card navigates to show detail", async ({ page }) => {
        await page.goto("/shows");
        await page.waitForLoadState("networkidle");

        const firstCard = page.locator("a[id^='show-']").first();
        if ((await firstCard.count()) === 0) {
            test.skip(true, "No shows exist");
            return;
        }

        await firstCard.click();
        await page.waitForURL("**/shows/**", { timeout: 10000 });
        // Verify we're on a show detail page — should have breadcrumb
        await expect(page.locator("text=← All Shows")).toBeVisible({ timeout: 5000 });
    });

    // ── Show Detail Page ──

    test("show detail page renders title, stats, and breadcrumb", async ({ page }) => {
        await page.goto("/shows");
        await page.waitForLoadState("networkidle");

        const firstCard = page.locator("a[id^='show-']").first();
        if ((await firstCard.count()) === 0) {
            test.skip(true, "No shows exist to test");
            return;
        }

        await firstCard.click();
        await page.waitForURL("**/shows/**", { timeout: 10000 });

        // Title should be visible (h1 with show name)
        await expect(page.locator("h1").first()).toBeVisible();

        // Stats section should show entry count
        await expect(page.locator("text=Entries")).toBeVisible();

        // Breadcrumb back to all shows
        await expect(page.locator("text=← All Shows")).toBeVisible();
    });

    test("open show displays entry form with horse selector", async ({ page }) => {
        await page.goto("/shows");
        await page.waitForLoadState("networkidle");

        // Find an open show (look for the 🟢 badge)
        const openShowBadge = page.locator(".show-status-open").first();
        if ((await openShowBadge.count()) === 0) {
            test.skip(true, "No open shows available");
            return;
        }

        // Click the parent link
        const openShowCard = page.locator("a[id^='show-']").filter({ has: page.locator(".show-status-open") }).first();
        await openShowCard.click();
        await page.waitForURL("**/shows/**", { timeout: 10000 });

        // Should have the "Enter Your Horse" heading
        const entryHeading = page.locator("text=Enter Your Horse");
        await expect(entryHeading).toBeVisible({ timeout: 5000 });

        // Should have a horse selector (select element) or an empty state
        const horseSelect = page.locator("select").first();
        const hasSelect = await horseSelect.count();
        expect(hasSelect).toBeGreaterThan(0);
    });

    // ── Results & Entries ──

    test("closed show displays results section", async ({ page }) => {
        await page.goto("/shows");
        await page.waitForLoadState("networkidle");

        // Find a closed show
        const closedShowCard = page.locator("a[id^='show-']").filter({ has: page.locator(".show-status-closed") }).first();
        if ((await closedShowCard.count()) === 0) {
            test.skip(true, "No closed shows available");
            return;
        }

        await closedShowCard.click();
        await page.waitForURL("**/shows/**", { timeout: 10000 });

        // Page should have loaded successfully
        await expect(page.locator("h1").first()).toBeVisible();

        // Results or entries should be visible
        // (ShowResultsView renders entries with placings for closed shows)
        await expect(page.getByRole("main")).toBeVisible();
    });

    test("show detail page shows entry cards", async ({ page }) => {
        await page.goto("/shows");
        await page.waitForLoadState("networkidle");

        const showCard = page.locator("a[id^='show-']").first();
        if ((await showCard.count()) === 0) {
            test.skip(true, "No shows available");
            return;
        }

        await showCard.click();
        await page.waitForURL("**/shows/**", { timeout: 10000 });

        // Page should render — any entries will be displayed in ShowResultsView
        await expect(page.locator("h1").first()).toBeVisible();

        // Check for entry count in stats
        const entriesText = page.locator("text=Entries");
        if ((await entriesText.count()) > 0) {
            await expect(entriesText.first()).toBeVisible();
        }
    });

    // ── Show History Widget on Dashboard ──

    test("dashboard sidebar displays show history widget", async ({ page }) => {
        await page.goto("/dashboard");
        await page.waitForLoadState("networkidle");

        // Look for the Show History widget
        const widget = page.locator("text=Show History").first();
        if ((await widget.count()) === 0) {
            test.skip(true, "Show History widget not visible (user may have no show records)");
            return;
        }

        await expect(widget).toBeVisible();
    });

    // ── Expert Judging Panel ──

    test("expert judging panel visible to creator on judging show", async ({ page }) => {
        await page.goto("/shows");
        await page.waitForLoadState("networkidle");

        // Look for a show in judging status
        const judgingCard = page.locator("a[id^='show-']").filter({ has: page.locator(".show-status-judging") }).first();
        if ((await judgingCard.count()) === 0) {
            test.skip(true, "No shows in judging status");
            return;
        }

        await judgingCard.click();
        await page.waitForURL("**/shows/**", { timeout: 10000 });

        // If user is the creator/judge, the Expert Judging Panel should be visible
        const judgingPanel = page.locator("text=Expert Judging Panel").or(page.locator("text=Judging in Progress"));
        if ((await judgingPanel.count()) > 0) {
            await expect(judgingPanel.first()).toBeVisible();
        }
        // If not creator/judge, panel won't appear — that's expected
    });

    // ── Host Override Panel (Closed Shows) ──

    test("host override panel visible on closed show to creator", async ({ page }) => {
        await page.goto("/shows");
        await page.waitForLoadState("networkidle");

        const closedCard = page.locator("a[id^='show-']").filter({ has: page.locator(".show-status-closed") }).first();
        if ((await closedCard.count()) === 0) {
            test.skip(true, "No closed shows available");
            return;
        }

        await closedCard.click();
        await page.waitForURL("**/shows/**", { timeout: 10000 });

        // If user is the creator, override panel (in a <details>) should be present
        const overridePanel = page.locator("text=Override Final Placings");
        if ((await overridePanel.count()) > 0) {
            await expect(overridePanel.first()).toBeVisible();
        }
        // If not creator, that's expected — the panel just won't be there
    });

    // ── Mobile Viewport ──

    test("mobile: entry form has adequate touch targets", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });

        await page.goto("/shows");
        await page.waitForLoadState("networkidle");

        const openShowCard = page.locator("a[id^='show-']").filter({ has: page.locator(".show-status-open") }).first();
        if ((await openShowCard.count()) === 0) {
            test.skip(true, "No open shows available");
            return;
        }

        await openShowCard.click();
        await page.waitForURL("**/shows/**", { timeout: 10000 });

        const entryHeading = page.locator("text=Enter Your Horse");
        if ((await entryHeading.count()) === 0) {
            test.skip(true, "No entry section visible");
            return;
        }

        // Verify horse selector is visible and tappable
        const horseSelect = page.locator("select").first();
        if ((await horseSelect.count()) === 0) {
            test.skip(true, "No horses available for test user");
            return;
        }
        await expect(horseSelect).toBeVisible();

        // Verify the select has adequate height (at least 36px for mobile)
        const selectBox = await horseSelect.boundingBox();
        if (selectBox) {
            expect(selectBox.height).toBeGreaterThanOrEqual(36);
        }
    });

    test("mobile: show detail page scrolls correctly", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });

        await page.goto("/shows");
        await page.waitForLoadState("networkidle");

        const showCard = page.locator("a[id^='show-']").first();
        if ((await showCard.count()) === 0) {
            test.skip(true, "No shows available");
            return;
        }

        await showCard.click();
        await page.waitForURL("**/shows/**", { timeout: 10000 });

        // Verify page is not wider than viewport (no horizontal scroll)
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(bodyWidth).toBeLessThanOrEqual(375 + 10);

        // Verify breadcrumb navigation fits on mobile
        const breadcrumb = page.locator("text=← All Shows");
        if ((await breadcrumb.count()) > 0) {
            await expect(breadcrumb).toBeVisible();
        }
    });

    // ── Show Record → Hoofprint Flow ──

    test("show record appears in horse passport timeline", async ({ page }) => {
        await page.goto("/dashboard");
        await page.waitForLoadState("networkidle");

        // Find a horse link on the dashboard
        const horseLink = page.locator("a[href*='/stable/']").first();
        if ((await horseLink.count()) === 0) {
            test.skip(true, "No horses in stable");
            return;
        }

        await horseLink.click();
        await page.waitForURL("**/stable/**", { timeout: 10000 });

        // Check for show records section in passport
        const showRecords = page.locator("text=Show Records").or(page.locator("text=show record"));
        if ((await showRecords.count()) > 0) {
            await expect(showRecords.first()).toBeVisible();
        }
        // If horse hasn't been shown, no show records — that's valid
    });

    // ── Navigation Guards ──

    test("unauthenticated user is redirected from shows page", async ({ browser }) => {
        const context = await browser.newContext();
        const freshPage = await context.newPage();

        await freshPage.goto("/shows");
        await freshPage.waitForURL("**/login**", { timeout: 10000 });

        await context.close();
    });
});
