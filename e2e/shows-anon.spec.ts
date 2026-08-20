import { test, expect } from "@playwright/test";

/**
 * Anon smoke — Batch 1 "Unlock the doors".
 *
 * The shows surface is the public front door: logged-out visitors
 * browse /shows and read any v2 show page (with its state banner).
 * No login wall on either.
 */
test.describe("Shows — anon smoke", () => {
    test("logged-out /shows renders show cards (no login wall)", async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto("/shows");
        await page.waitForLoadState("networkidle");

        // Still on /shows — not bounced to /login
        await expect(page).not.toHaveURL(/\/login/);
        await expect(page.getByRole("heading", { level: 1, name: "Shows" })).toBeVisible({
            timeout: 10000,
        });

        // The honest open-entries stat renders for anon
        await expect(page.getByText("Open for entries right now")).toBeVisible();

        // Sign-in CTA where authed actions would be
        await expect(page.getByRole("link", { name: "Log in to enter" }).first()).toBeVisible();

        await context.close();
    });

    test("logged-out v2 show page renders with the state banner", async ({ browser }) => {
        const context = await browser.newContext();
        const page = await context.newPage();

        await page.goto("/shows");
        await page.waitForLoadState("networkidle");

        // v2 cards are the .ledger-card links; legacy cards are members-only
        // and never render for anon.
        const v2Card = page.locator("a.ledger-card[id^='show-']").first();
        if ((await v2Card.count()) === 0) {
            await context.close();
            test.skip(true, "No v2 shows exist to test");
            return;
        }

        await v2Card.click();
        await page.waitForURL("**/shows/**", { timeout: 10000 });

        // Not walled, and the lifecycle status is visible in the
        // album masthead's status line.
        await expect(page).not.toHaveURL(/\/login/);
        await expect(page.getByTestId("album-status-line").first()).toBeVisible({
            timeout: 10000,
        });

        await context.close();
    });
});
