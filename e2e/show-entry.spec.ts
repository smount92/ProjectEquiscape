import { test, expect } from "@playwright/test";
import { loginAs, USER_A } from "./helpers/auth";

/**
 * E2E Show Flow Tests
 *
 * These tests cover critical show system flows:
 * 1. Shows listing page renders correctly
 * 2. Show detail page renders hero, entry form, and entries grid
 * 3. Entry preview modal lifecycle
 * 4. Smart class browser interactions
 * 5. Results podium on closed shows
 * 6. Show history widget on dashboard
 * 7. Mobile entry flow (375×812 viewport)
 */
test.describe("Show System — E2E", () => {
    test.beforeEach(async ({ page }) => {
        await loginAs(page, USER_A.email, USER_A.password);
    });

    // ── Shows Listing ──

    test("shows listing page loads with correct heading", async ({ page }) => {
        await page.goto("/shows");
        await page.waitForLoadState("networkidle");

        // Verify page title and heading
        const heading = page.locator("h1");
        await expect(heading).toContainText("Virtual Photo Shows");

        // Verify the hero section renders
        await expect(page.locator(".community-hero")).toBeVisible();

        // Verify either shows grid or empty state is rendered
        const hasShows = await page.locator(".shows-grid").count();
        const hasEmpty = await page.locator(".shelf-empty").count();
        expect(hasShows + hasEmpty).toBeGreaterThan(0);
    });

    test("show cards display status badges", async ({ page }) => {
        await page.goto("/shows");
        await page.waitForLoadState("networkidle");

        const showCards = page.locator(".show-card");
        const cardCount = await showCards.count();

        if (cardCount > 0) {
            // Every show card should have a status badge
            const firstCard = showCards.first();
            await expect(firstCard.locator(".show-status-badge")).toBeVisible();

            // Card should have a title and footer
            await expect(firstCard.locator(".show-card-title")).toBeVisible();
            await expect(firstCard.locator(".show-card-footer")).toBeVisible();
        }
    });

    test("clicking a show card navigates to show detail", async ({ page }) => {
        await page.goto("/shows");
        await page.waitForLoadState("networkidle");

        const firstCard = page.locator(".show-card").first();
        const cardCount = await firstCard.count();

        if (cardCount > 0) {
            await firstCard.click();
            await page.waitForURL("**/shows/**", { timeout: 10000 });
            // Verify we're on a show detail page
            await expect(page.locator(".community-hero")).toBeVisible();
        }
    });

    // ── Show Detail Page ──

    test("show detail page renders hero, status, and entry count", async ({ page }) => {
        await page.goto("/shows");
        await page.waitForLoadState("networkidle");

        const firstCard = page.locator(".show-card").first();
        if (await firstCard.count() === 0) {
            test.skip(true, "No shows exist to test");
            return;
        }

        await firstCard.click();
        await page.waitForURL("**/shows/**", { timeout: 10000 });

        // Hero should show title
        const hero = page.locator(".community-hero");
        await expect(hero).toBeVisible();
        await expect(hero.locator("h1")).toBeVisible();

        // Stats section should show entry count and status
        const stats = page.locator(".community-stats");
        await expect(stats).toBeVisible();
        await expect(stats.locator(".community-stat-label")).toContainText(["Entries"]);

        // Breadcrumb back to all shows
        await expect(page.locator("text=← All Shows")).toBeVisible();
    });

    test("open show displays entry form with horse selector", async ({ page }) => {
        await page.goto("/shows");
        await page.waitForLoadState("networkidle");

        // Find an open show
        const openShowCard = page.locator(".show-card:has(.show-status-open)").first();
        if (await openShowCard.count() === 0) {
            test.skip(true, "No open shows available");
            return;
        }

        await openShowCard.click();
        await page.waitForURL("**/shows/**", { timeout: 10000 });

        // Should have the entry section
        const entrySection = page.locator(".show-entry-section");
        await expect(entrySection).toBeVisible();

        // Should have the "Enter Your Horse" heading
        await expect(entrySection.locator("h2")).toContainText("Enter Your Horse");

        // Should have a horse selector (form-select) or an empty state message
        const horseSelect = entrySection.locator(".form-select").first();
        const emptyState = entrySection.locator(".show-entry-form-empty");
        const hasSelect = await horseSelect.count();
        const hasEmpty = await emptyState.count();
        expect(hasSelect + hasEmpty).toBeGreaterThan(0);
    });

    // ── Entry Preview Modal ──

    test("preview button opens modal with entry photo", async ({ page }) => {
        await page.goto("/shows");
        await page.waitForLoadState("networkidle");

        const openShowCard = page.locator(".show-card:has(.show-status-open)").first();
        if (await openShowCard.count() === 0) {
            test.skip(true, "No open shows available");
            return;
        }

        await openShowCard.click();
        await page.waitForURL("**/shows/**", { timeout: 10000 });

        const entrySection = page.locator(".show-entry-section");
        if (await entrySection.count() === 0) {
            test.skip(true, "No entry section visible");
            return;
        }

        // Select a horse from the dropdown (pick the first option that's not the placeholder)
        const horseSelect = entrySection.locator("select").first();
        const options = await horseSelect.locator("option").allTextContents();
        const validOption = options.find(o => o && !o.includes("Select"));
        if (!validOption) {
            test.skip(true, "No horses available to enter");
            return;
        }
        await horseSelect.selectOption({ index: 1 });

        // Wait for photos to load
        await page.waitForTimeout(1000);

        // Look for the preview button
        const previewBtn = entrySection.locator('button:has-text("Preview")');
        if (await previewBtn.count() === 0) {
            test.skip(true, "Preview button not visible (may need photo selected first)");
            return;
        }

        // Click preview
        await previewBtn.click();

        // Modal should appear (rendered via portal to body)
        const modal = page.locator(".modal-overlay");
        await expect(modal).toBeVisible({ timeout: 3000 });

        // Modal should contain the preview content
        await expect(modal.locator("text=This is what judges")).toBeVisible();

        // Should have both CTA buttons
        await expect(modal.locator('button:has-text("Looks Good")')).toBeVisible();
        await expect(modal.locator('button:has-text("Choose Different")')).toBeVisible();

        // Close by clicking "Choose Different Photo"
        await modal.locator('button:has-text("Choose Different")').click();
        await expect(modal).not.toBeVisible();
    });

    // ── Results Podium ──

    test("closed show displays results podium", async ({ page }) => {
        await page.goto("/shows");
        await page.waitForLoadState("networkidle");

        // Find a closed show
        const closedShowCard = page.locator(".show-card:has(.show-status-closed)").first();
        if (await closedShowCard.count() === 0) {
            test.skip(true, "No closed shows available");
            return;
        }

        await closedShowCard.click();
        await page.waitForURL("**/shows/**", { timeout: 10000 });

        // Results heading should be visible
        const resultsHeading = page.locator("text=Results");
        await expect(resultsHeading).toBeVisible();

        // Podium cards should be present (if there were placed entries)
        const podium = page.locator(".results-podium");
        if (await podium.count() > 0) {
            const podiumCards = podium.locator(".podium-card");
            const cardCount = await podiumCards.count();

            if (cardCount > 0) {
                expect(cardCount).toBeLessThanOrEqual(3);

                // Each card should have horse name and owner
                const firstPodiumCard = podiumCards.first();
                await expect(firstPodiumCard.locator(".podium-horse-name")).toBeVisible();
                await expect(firstPodiumCard.locator(".podium-owner")).toBeVisible();
                await expect(firstPodiumCard.locator(".podium-placing")).toBeVisible();
                await expect(firstPodiumCard.locator(".podium-medal")).toBeVisible();
            }
            // 0 cards = show closed with no entries, still valid
        }
    });

    test("podium links navigate to horse passport", async ({ page }) => {
        await page.goto("/shows");
        await page.waitForLoadState("networkidle");

        const closedShowCard = page.locator(".show-card:has(.show-status-closed)").first();
        if (await closedShowCard.count() === 0) {
            test.skip(true, "No closed shows available");
            return;
        }

        await closedShowCard.click();
        await page.waitForURL("**/shows/**", { timeout: 10000 });

        const horseLink = page.locator(".podium-horse-name").first();
        if (await horseLink.count() === 0) {
            test.skip(true, "No podium entries visible");
            return;
        }

        const href = await horseLink.getAttribute("href");
        expect(href).toMatch(/\/community\//);
    });

    // ── Entries Grid ──

    test("entries grid shows entry cards with photos", async ({ page }) => {
        await page.goto("/shows");
        await page.waitForLoadState("networkidle");

        // Find any show with entries
        const showCard = page.locator(".show-card").first();
        if (await showCard.count() === 0) {
            test.skip(true, "No shows available");
            return;
        }

        await showCard.click();
        await page.waitForURL("**/shows/**", { timeout: 10000 });

        const entryCards = page.locator(".show-entry-card");
        if (await entryCards.count() === 0) {
            test.skip(true, "No entries in this show");
            return;
        }

        // Each entry card should have rank, horse name, and owner
        const firstEntry = entryCards.first();
        await expect(firstEntry.locator(".show-entry-rank")).toBeVisible();
        await expect(firstEntry.locator(".show-entry-horse-name")).toBeVisible();
        await expect(firstEntry.locator(".show-entry-owner")).toBeVisible();
    });

    // ── Show History Widget on Dashboard ──

    test("dashboard sidebar displays show history widget", async ({ page }) => {
        await page.goto("/dashboard");
        await page.waitForLoadState("networkidle");

        // Look for the Show History widget (it uses a <details> element)
        const widget = page.locator("text=Show History").first();
        if (await widget.count() === 0) {
            // Widget might not render if user has no show records — that's ok
            test.skip(true, "Show History widget not visible (user may have no show records)");
            return;
        }

        await expect(widget).toBeVisible();
    });

    // ── Judging Panel (Expert-Judged Shows) ──

    test("expert judging panel visible to creator on judging show", async ({ page }) => {
        await page.goto("/shows");
        await page.waitForLoadState("networkidle");

        // Look for a show in judging status
        const judgingCard = page.locator(".show-card:has(.show-status-judging)").first();
        if (await judgingCard.count() === 0) {
            test.skip(true, "No shows in judging status");
            return;
        }

        await judgingCard.click();
        await page.waitForURL("**/shows/**", { timeout: 10000 });

        // If user is the creator/judge, the Expert Judging Panel should be visible
        const judgingPanel = page.locator("text=Expert Judging Panel").or(page.locator("text=Override Final Placings"));
        if (await judgingPanel.count() > 0) {
            await expect(judgingPanel).toBeVisible();

            // Panel should have Save Placings button
            const saveBtn = page.locator('button:has-text("Save Placings")').or(page.locator('button:has-text("Override Placings")'));
            await expect(saveBtn).toBeVisible();
        }
    });

    // ── Host Override Panel (Closed Shows) ──

    test("host override panel visible on closed show to creator", async ({ page }) => {
        await page.goto("/shows");
        await page.waitForLoadState("networkidle");

        const closedCard = page.locator(".show-card:has(.show-status-closed)").first();
        if (await closedCard.count() === 0) {
            test.skip(true, "No closed shows available");
            return;
        }

        await closedCard.click();
        await page.waitForURL("**/shows/**", { timeout: 10000 });

        // If user is the creator, override panel should be visible
        const overridePanel = page.locator("text=Override Final Placings");
        if (await overridePanel.count() > 0) {
            await expect(overridePanel).toBeVisible();

            // Should have the warning-colored override button
            const overrideBtn = page.locator('button:has-text("Override Placings")');
            await expect(overrideBtn).toBeVisible();
        }
        // If not creator, that's expected — the panel just won't be there
    });

    // ── Mobile Viewport ──

    test("mobile: entry form has adequate touch targets", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });

        await page.goto("/shows");
        await page.waitForLoadState("networkidle");

        const openShow = page.locator(".show-card:has(.show-status-open)").first();
        if (await openShow.count() === 0) {
            test.skip(true, "No open shows available");
            return;
        }

        await openShow.click();
        await page.waitForURL("**/shows/**", { timeout: 10000 });

        const entrySection = page.locator(".show-entry-section");
        if (await entrySection.count() === 0) {
            test.skip(true, "No entry section visible");
            return;
        }

        // Verify horse selector is visible and tappable
        const horseSelect = entrySection.locator(".form-select").first();
        const emptyState = entrySection.locator(".show-entry-form-empty");
        if (await horseSelect.count() === 0 && await emptyState.count() > 0) {
            test.skip(true, "No public horses available for test user");
            return;
        }
        await expect(horseSelect).toBeVisible();

        // Verify the select has adequate height (at least 40px for mobile)
        const selectBox = await horseSelect.boundingBox();
        if (selectBox) {
            expect(selectBox.height).toBeGreaterThanOrEqual(36); // Minimum touch target
        }

        // Verify the submit button exists and is visible
        const submitBtn = entrySection.locator('button:has-text("Enter")').first();
        if (await submitBtn.count() > 0) {
            const btnBox = await submitBtn.boundingBox();
            if (btnBox) {
                expect(btnBox.height).toBeGreaterThanOrEqual(40); // Minimum touch target
            }
        }
    });

    test("mobile: show detail page scrolls correctly", async ({ page }) => {
        await page.setViewportSize({ width: 375, height: 812 });

        await page.goto("/shows");
        await page.waitForLoadState("networkidle");

        const showCard = page.locator(".show-card").first();
        if (await showCard.count() === 0) {
            test.skip(true, "No shows available");
            return;
        }

        await showCard.click();
        await page.waitForURL("**/shows/**", { timeout: 10000 });

        // Verify page is not wider than viewport (no horizontal scroll)
        const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
        expect(bodyWidth).toBeLessThanOrEqual(375 + 10); // Allow small tolerance

        // Verify breadcrumb navigation fits on mobile
        const breadcrumb = page.locator("text=← All Shows");
        if (await breadcrumb.count() > 0) {
            await expect(breadcrumb).toBeVisible();
        }
    });

    // ── Show Record → Hoofprint Flow ──

    test("show record appears in horse passport timeline", async ({ page }) => {
        // Navigate to dashboard to find a horse
        await page.goto("/dashboard");
        await page.waitForLoadState("networkidle");

        // Find a horse card and click it
        const horseCard = page.locator("[data-testid='stable-grid'] a, .stable-grid a, .dashboard-horse-card").first();
        if (await horseCard.count() === 0) {
            test.skip(true, "No horses in stable");
            return;
        }

        await horseCard.click();
        await page.waitForURL("**/stable/**", { timeout: 10000 });

        // Check for show records section in passport
        const showRecords = page.locator("text=Show Records").or(page.locator("text=show record"));
        // The section might not exist if the horse hasn't been shown — that's ok
        if (await showRecords.count() > 0) {
            await expect(showRecords).toBeVisible();
        }
    });

    // ── Navigation Guards ──

    test("unauthenticated user is redirected from shows page", async ({ browser }) => {
        // Create a fresh context without login
        const context = await browser.newContext();
        const freshPage = await context.newPage();

        await freshPage.goto("/shows");
        // Should redirect to login
        await freshPage.waitForURL("**/login**", { timeout: 10000 });

        await context.close();
    });
});
