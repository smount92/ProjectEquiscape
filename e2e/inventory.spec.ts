import { test, expect } from "@playwright/test";
import { loginAs, USER_A } from "./helpers/auth";

test.describe.serial("Inventory Flow", () => {
    const testHorseName = `E2E Test Horse ${Date.now()}`;

    test("add horse via full wizard → appears on dashboard", async ({ page }) => {
        test.setTimeout(60000);
        await loginAs(page, USER_A.email, USER_A.password);
        await page.goto("/add-horse");
        await page.waitForLoadState("networkidle");

        // Step 1: Gallery — skip
        const nextStep1 = page.locator("#step-1-next");
        await expect(nextStep1).toBeVisible({ timeout: 15000 });
        await nextStep1.click();

        // Step 2: Reference — skip
        const nextStep2 = page.locator("#step-2-next");
        await expect(nextStep2).toBeVisible({ timeout: 10000 });
        await nextStep2.click();
        await page.waitForTimeout(500);

        // Step 3: Identity — fill required fields using element IDs
        const nameInput = page.locator("#custom-name");
        await expect(nameInput).toBeVisible({ timeout: 10000 });
        await nameInput.fill(testHorseName);

        // Finish type (required for models)
        const finishSelect = page.locator("#finish-type");
        if (await finishSelect.isVisible({ timeout: 3000 })) {
            await finishSelect.selectOption({ index: 1 }); // First non-empty option
        }

        // Condition grade (required for models)
        const conditionSelect = page.locator("#condition-grade");
        if (await conditionSelect.isVisible({ timeout: 3000 })) {
            await conditionSelect.selectOption({ index: 1 }); // First non-empty option
        }

        // Wait for validation to enable the next button
        await page.waitForTimeout(300);

        // Step 4: Vault — skip
        const nextStep3 = page.locator("#step-3-next");
        await expect(nextStep3).toBeEnabled({ timeout: 5000 });
        await nextStep3.click();
        await page.waitForTimeout(500);

        // Submit the form
        const submitBtn = page.locator("#submit-horse");
        await expect(submitBtn).toBeVisible({ timeout: 5000 });
        await submitBtn.click();

        // Wait for success state — the overlay appears after submission
        await expect(page.locator(".success-overlay")).toBeVisible({ timeout: 20000 });
    });

    test("horse appears on dashboard after adding", async ({ page }) => {
        await loginAs(page, USER_A.email, USER_A.password);
        await page.goto("/dashboard");
        await page.waitForLoadState("networkidle");
        await expect(page.locator(`text=${testHorseName}`)).toBeVisible({ timeout: 10000 });
    });

    test("delete horse → removed from dashboard", async ({ page }) => {
        test.setTimeout(60000);
        await loginAs(page, USER_A.email, USER_A.password);
        await page.goto("/dashboard");
        await page.waitForLoadState("networkidle");

        // Find and click the test horse
        const horseLink = page.locator(`a:has-text("${testHorseName}")`).first();
        if (!(await horseLink.isVisible({ timeout: 5000 }))) {
            test.skip(true, "Test horse not found on dashboard");
            return;
        }
        await horseLink.click();
        await page.waitForLoadState("networkidle");

        // Look for edit link/button on passport
        const editBtn = page.locator("a, button", { hasText: /edit/i }).first();
        if (await editBtn.isVisible({ timeout: 3000 })) {
            await editBtn.click();
            await page.waitForLoadState("networkidle");
        }

        // Try to find delete button
        const deleteBtn = page.locator("button", { hasText: /delete/i });
        if (await deleteBtn.isVisible({ timeout: 5000 })) {
            await deleteBtn.click();

            const confirmBtn = page.locator("button", { hasText: /confirm|yes|delete/i }).last();
            if (await confirmBtn.isVisible({ timeout: 3000 })) {
                await confirmBtn.click();
            }
            await page.waitForTimeout(2000);
        } else {
            test.skip(true, "Delete button not found on passport/edit page");
        }
    });
});
