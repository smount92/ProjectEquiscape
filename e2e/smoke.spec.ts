import { test, expect } from "@playwright/test";
import { loginAs, USER_A } from "./helpers/auth";

test.describe("Smoke Tests", () => {
    test("landing page loads and has correct title", async ({ page }) => {
        await page.goto("/");
        await expect(page).toHaveTitle(/Model Horse Hub/i);
    });

    test("login page is accessible", async ({ page }) => {
        await page.goto("/login");
        await expect(page.locator("text=Sign In").or(page.locator("text=Log In"))).toBeVisible();
    });

    test("signup page is accessible", async ({ page }) => {
        await page.goto("/signup");
        await expect(page.locator("body")).not.toContainText("500");
    });

    test("dashboard loads within 5 seconds", async ({ page }) => {
        await loginAs(page, USER_A.email, USER_A.password);

        const start = Date.now();
        await page.goto("/dashboard");
        await page.waitForSelector("[data-testid='stable-grid'], .dashboard-grid, .stable-empty, .dashboard-content", { timeout: 10000 });
        const loadTime = Date.now() - start;

        console.log(`Dashboard load time: ${loadTime}ms`);
        expect(loadTime).toBeLessThan(5000);
    });
});
