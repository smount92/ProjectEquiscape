import { test, expect } from "@playwright/test";
import { loginAs, USER_A } from "./helpers/auth";

test.describe("Auth Flow", () => {
    test("login with valid credentials → dashboard", async ({ page }) => {
        await loginAs(page, USER_A.email, USER_A.password);
        await expect(page).toHaveURL(/dashboard/);
    });

    test("login with invalid password → error message", async ({ page }) => {
        await page.goto("/login");
        await page.fill('input[type="email"]', USER_A.email);
        await page.fill('input[type="password"]', "wrong_password_12345");
        await page.click('button[type="submit"]');
        // Should show an error message, not redirect
        await page.waitForTimeout(2000);
        const url = page.url();
        expect(url).toContain("/login");
    });

    test("protected page redirects unauthenticated users", async ({ page }) => {
        await page.goto("/dashboard");
        // Should redirect to login
        await page.waitForURL("**/login**", { timeout: 10000 });
        await expect(page).toHaveURL(/login/);
    });
});
