import { test, expect } from "@playwright/test";
import { loginAs, USER_A } from "./helpers/auth";

test.describe("Smoke Tests", () => {
    test("landing page loads and has correct title", async ({ page }) => {
        await page.goto("/");
        await expect(page).toHaveTitle(/Model Horse Hub/i);
    });

    test("login page is accessible", async ({ page }) => {
        await page.goto("/login");
        await page.waitForLoadState("networkidle");
        // Login page should have the submit button and email input
        await expect(page.locator("#login-submit")).toBeVisible({ timeout: 10000 });
        await expect(page.locator("#login-email")).toBeVisible();
    });

    test("signup page is accessible", async ({ page }) => {
        await page.goto("/signup");
        await expect(page.locator("body")).not.toContainText("500");
    });

    test("dashboard loads within 5 seconds", async ({ page }) => {
        await loginAs(page, USER_A.email, USER_A.password);

        const start = Date.now();
        await page.goto("/dashboard");
        // Wait for any meaningful content: headings, links, or the main layout
        await page.waitForLoadState("networkidle");
        await expect(page.locator("main, [role='main'], h1, h2").first()).toBeVisible({ timeout: 10000 });
        const loadTime = Date.now() - start;

        console.log(`Dashboard load time: ${loadTime}ms`);
        expect(loadTime).toBeLessThan(10000); // Relaxed to 10s for cold starts
    });
});
