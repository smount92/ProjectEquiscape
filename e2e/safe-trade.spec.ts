import { test, expect } from "@playwright/test";

test.describe("Safe-Trade Commerce Flow", () => {
    test.skip("Seller lists horse as For Sale", async ({ page }) => {
        // TODO: Login as seller, navigate to horse, set trade status
    });

    test.skip("Buyer makes an offer", async ({ page }) => {
        // TODO: Login as buyer, navigate to Show Ring, click Make Offer
    });

    test.skip("Seller accepts offer → status = pending_payment", async ({ page }) => {
        // TODO: Verify offer card state change
    });

    test.skip("Buyer marks payment sent → status = funds_verified", async ({ page }) => {
        // TODO: Verify state machine transition
    });

    test.skip("Seller confirms receipt → status = completed", async ({ page }) => {
        // TODO: Verify completion, review prompt appears
    });
});
