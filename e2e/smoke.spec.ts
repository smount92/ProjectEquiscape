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

    test("signup page is accessible", async ({ page }) => {
        await page.goto("/signup");
        await expect(page.locator("body")).not.toContainText("500");
    });
});
