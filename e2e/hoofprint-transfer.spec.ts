import { test, expect } from "@playwright/test";
import { loginAs, USER_A, USER_B } from "./helpers/auth";

test.describe("Hoofprint Transfer Flow", () => {
    test("Owner can navigate to a horse passport and see transfer option", async ({ page }) => {
        await loginAs(page, USER_A.email, USER_A.password);
        await page.goto("/dashboard");
        await page.waitForLoadState("networkidle");

        // Click the first horse card
        const horseCard = page.locator(".stable-grid a, .dashboard-content a[href*='/stable/']").first();
        if (!(await horseCard.isVisible({ timeout: 5000 }))) {
            test.skip(true, "No horses in stable to test transfer");
            return;
        }
        await horseCard.click();
        await page.waitForLoadState("networkidle");

        // Look for Transfer button/link on the passport page
        const transferBtn = page.locator("button, a", { hasText: /transfer/i });
        await expect(transferBtn.first()).toBeVisible({ timeout: 5000 });
    });

    test.fixme("Recipient claims horse with code", async ({ page }) => {
        // FIXME: Requires second browser context (different user session)
        // Steps: Login as User B → go to /claim → enter code → verify success
    });

    test.fixme("Ownership is swapped correctly", async ({ page }) => {
        // FIXME: Requires second browser context (multi-user verification)
        // Steps: Verify horse appears in User B's dashboard
        //        Verify horse removed from User A's dashboard
    });
});
