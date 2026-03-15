import { test, expect } from "@playwright/test";
import { loginAs, USER_A, USER_B } from "./helpers/auth";

test.describe("Safe-Trade Commerce Flow", () => {
    test.skip("Seller lists horse as For Sale", async ({ page }) => {
        await loginAs(page, USER_A.email, USER_A.password);
        // TODO: Navigate to a horse → Edit → set trade status to "For Sale" → save
        // Verify: horse card shows "For Sale" badge
    });

    test.skip("Buyer makes an offer", async ({ page }) => {
        await loginAs(page, USER_B.email, USER_B.password);
        // TODO: Navigate to Show Ring (community) → find the listed horse
        // Click "Make Offer" → enter amount → submit
        // Verify: conversation opens with offer card
    });

    test.skip("Seller accepts offer → status = pending_payment", async ({ page }) => {
        // Pre-requisite: steps 1-2 completed
        // TODO: Login as User A → open inbox → find offer → click Accept
        // Verify: offer card state changes to "pending_payment"
    });

    test.skip("Buyer marks payment sent → status = funds_verified", async ({ page }) => {
        // Pre-requisite: step 3 completed
        // TODO: Login as User B → open inbox → click "I've Sent Payment"
        // Verify: state machine transition
    });

    test.skip("Seller confirms receipt → status = completed", async ({ page }) => {
        // Pre-requisite: step 4 completed
        // TODO: Login as User A → click "Verify & Release"
        // Verify: completion, review prompt appears
    });
});
