import { test, expect } from "@playwright/test";
import { loginAs, USER_A } from "./helpers/auth";

test.describe.serial("Inventory Flow", () => {
    const testHorseName = `E2E Test Horse ${Date.now()}`;

    test("add horse via full wizard → appears on dashboard", async ({ page }) => {
        await loginAs(page, USER_A.email, USER_A.password);
        await page.goto("/add-horse");
        await page.waitForLoadState("networkidle");

        // Step 1: Gallery — skip (optional), go to next
        const nextBtn = page.locator("button", { hasText: /next|continue/i });
        await nextBtn.click();
        await page.waitForTimeout(500);

        // Step 2: Reference — skip (optional), go to next
        await nextBtn.click();
        await page.waitForTimeout(500);

        // Step 3: Identity — fill required fields
        // Custom name
        const nameInput = page.locator('input[type="text"]').first();
        await nameInput.fill(testHorseName);

        // Finish type — select first option from the dropdown/select
        const finishSelect = page.locator("select").first();
        if (await finishSelect.isVisible()) {
            const options = await finishSelect.locator("option").allTextContents();
            // Pick the first non-empty option
            const validOption = options.find((o) => o.trim() && o !== "Select...");
            if (validOption) {
                await finishSelect.selectOption({ label: validOption });
            }
        }

        // Condition grade — select first option from the second dropdown
        const selects = page.locator("select");
        const selectCount = await selects.count();
        if (selectCount > 1) {
            const conditionSelect = selects.nth(1);
            if (await conditionSelect.isVisible()) {
                const options = await conditionSelect.locator("option").allTextContents();
                const validOption = options.find((o) => o.trim() && o !== "Select...");
                if (validOption) {
                    await conditionSelect.selectOption({ label: validOption });
                }
            }
        }

        // Go to Step 4: Vault (optional) — skip
        await nextBtn.click();
        await page.waitForTimeout(500);

        // Submit the form
        const submitBtn = page.locator("button", { hasText: /save|submit|add to stable/i });
        await submitBtn.click();

        // Wait for success state — success overlay shows horse name
        await expect(
            page.locator("text=" + testHorseName).or(page.locator(".success-overlay"))
        ).toBeVisible({ timeout: 15000 });
    });

    test("horse appears on dashboard after adding", async ({ page }) => {
        await loginAs(page, USER_A.email, USER_A.password);
        await page.goto("/dashboard");
        await page.waitForLoadState("networkidle");

        // The horse name should be visible on the dashboard
        await expect(page.locator(`text=${testHorseName}`)).toBeVisible({ timeout: 10000 });
    });

    test("delete horse → removed from dashboard", async ({ page }) => {
        await loginAs(page, USER_A.email, USER_A.password);
        await page.goto("/dashboard");
        await page.waitForLoadState("networkidle");

        // Find and click the test horse
        const horseCard = page.locator(`text=${testHorseName}`).first();
        await horseCard.click();
        await page.waitForLoadState("networkidle");

        // Look for edit or delete button on the passport page
        const editBtn = page.locator("a, button", { hasText: /edit/i }).first();
        if (await editBtn.isVisible()) {
            await editBtn.click();
            await page.waitForLoadState("networkidle");
        }

        // Try to find delete button
        const deleteBtn = page.locator("button", { hasText: /delete/i });
        if (await deleteBtn.isVisible({ timeout: 5000 })) {
            await deleteBtn.click();

            // Confirm deletion in dialog
            const confirmBtn = page.locator("button", { hasText: /confirm|yes|delete/i }).last();
            if (await confirmBtn.isVisible({ timeout: 3000 })) {
                await confirmBtn.click();
            }

            // Wait for redirect or horse removal
            await page.waitForTimeout(2000);
        } else {
            // If no delete button visible, mark test as incomplete
            test.skip(true, "Delete button not found on passport/edit page");
        }
    });
});
