import { test, expect } from "@playwright/test";
import { loginAs, USER_A, USER_B } from "./helpers/auth";

test.describe("Safe-Trade Commerce Flow", () => {
    test("Seller can view trade status on a horse passport", async ({ page }) => {
        await loginAs(page, USER_A.email, USER_A.password);
        await page.goto("/dashboard");
        await page.waitForLoadState("networkidle");

        // Click first horse
        const horseCard = page.locator(".stable-grid a, .dashboard-content a[href*='/stable/']").first();
        if (!(await horseCard.isVisible({ timeout: 5000 }))) {
            test.skip(true, "No horses in stable to test trade");
            return;
        }
        await horseCard.click();
        await page.waitForLoadState("networkidle");

        // The passport page should show trade status somewhere
        const tradeSection = page.locator("text=/for sale|not for sale|trade status|open to offers/i");
        await expect(tradeSection.first()).toBeVisible({ timeout: 5000 });
    });

    test("Buyer can browse Show Ring and see listed horses", async ({ page }) => {
        await loginAs(page, USER_B.email, USER_B.password);
        await page.goto("/community");
        await page.waitForLoadState("networkidle");

        // Show Ring should load without server errors
        await expect(page.locator("body")).not.toContainText("500");
        await expect(page.locator("body")).not.toContainText("Application error");
        // Page should have loaded — main content exists
        await expect(page.getByRole("main")).toBeVisible({ timeout: 5000 });
    });

    test.fixme("Seller accepts offer → status = pending_payment", async () => {
        // FIXME: Requires an active offer to exist between User A and User B
    });

    test.fixme("Buyer marks payment sent → status = funds_verified", async () => {
        // FIXME: Requires step 3 completed — pending_payment state
    });

    test.fixme("Seller confirms receipt → status = completed", async () => {
        // FIXME: Requires step 4 completed — funds_verified state
    });
});
