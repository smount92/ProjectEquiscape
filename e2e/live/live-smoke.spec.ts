/**
 * Live smoke test: run after every release against the real site, logged
 * out, read-only. It proves the pages members reach first still load.
 *
 *   SMOKE_URL=https://modelhorsehub.com npx playwright test -c playwright.live.config.ts
 *
 * Keep it small and gentle: a handful of page loads, no writes, no logins.
 */
import { expect, test, type Page } from "@playwright/test";

async function loads(page: Page, path: string) {
    const res = await page.goto(path, { waitUntil: "domcontentloaded" });
    expect(res, `${path} returned no response`).not.toBeNull();
    expect(res!.status(), `${path} status`).toBeLessThan(400);
    // The error boundary's own words; none of these should ever show.
    await expect(page.locator("body")).not.toContainText("This page didn’t load");
    await expect(page.locator("body")).not.toContainText("Something threw a shoe");
}

test("home page", async ({ page }) => {
    await loads(page, "/");
    await expect(page).toHaveTitle(/Model Horse Hub/i);
});

test("Registry search finds a well-known mold", async ({ page }) => {
    await loads(page, "/catalog?q=silky%20sullivan");
    await expect(page.locator("body")).toContainText(/Silky Sullivan/i, { timeout: 15000 });
});

test("a maker's Registry page lists molds", async ({ page }) => {
    await loads(page, "/reference/breyer");
    await expect(page.locator("a[href^='/reference/breyer/']").first()).toBeVisible({ timeout: 15000 });
});

test("a reference page opens from the maker page", async ({ page }) => {
    await loads(page, "/reference/breyer");
    const href = await page.locator("a[href^='/reference/breyer/']").first().getAttribute("href");
    expect(href).toBeTruthy();
    await loads(page, href!);
    await expect(page.locator("h1").first()).toBeVisible();
});

test("shows, market and the Show Ring load", async ({ page }) => {
    await loads(page, "/shows");
    await loads(page, "/market");
    await loads(page, "/community");
});
