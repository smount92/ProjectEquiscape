import { test, expect } from "@playwright/test";
import { loginAs, USER_A, USER_B } from "./helpers/auth";

test.describe("Hoofprint Transfer Flow", () => {
    test.skip("Owner generates transfer code", async ({ page }) => {
        await loginAs(page, USER_A.email, USER_A.password);
        // TODO: Navigate to horse passport → click Transfer → verify 6-char code appears
        // Verify: code matches /[A-Z0-9]{6}/ format
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
