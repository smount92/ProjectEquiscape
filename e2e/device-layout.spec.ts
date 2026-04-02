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
test.describe("Authenticated pages", () => {
    test.beforeEach(async ({ page }) => {
        if (!process.env.TEST_USER_A_EMAIL || !process.env.TEST_USER_A_PASSWORD) {
            test.skip(true, "TEST_USER_A credentials not configured");
            return;
        }

        // Login via Supabase auth
        await page.goto("/login");
        await page.fill('input[type="email"]', process.env.TEST_USER_A_EMAIL);
        await page.fill('input[type="password"]', process.env.TEST_USER_A_PASSWORD);
        await page.click('button[type="submit"]');
        await page.waitForURL("**/dashboard**", { timeout: 10000 });
    });

    for (const { path, label } of AUTH_PAGES) {
        test(`No horizontal overflow on ${label} (${path})`, async ({ page }) => {
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
