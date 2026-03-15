import { test, expect } from "@playwright/test";

test.describe("Hoofprint Transfer Flow", () => {
    test.skip("Owner generates transfer code", async ({ page }) => {
        // TODO: Login, navigate to horse, click Transfer, verify 6-char code
    });

    test.skip("Recipient claims horse with code", async ({ page }) => {
        // TODO: Login as different user, go to /claim, enter code
    });

    test.skip("Ownership is swapped correctly", async ({ page }) => {
        // TODO: Verify horse appears in recipient's dashboard
        // TODO: Verify horse removed from sender's dashboard
    });
});
