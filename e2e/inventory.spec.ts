import { test, expect } from "@playwright/test";
import { loginAs, USER_A } from "./helpers/auth";

test.describe("Inventory Flow", () => {
    test.skip("add horse via quick add → appears on dashboard", async ({ page }) => {
        await loginAs(page, USER_A.email, USER_A.password);
        // TODO: navigate to add horse, fill quick-add form, submit
        // Verify horse appears on dashboard
    });

    test.skip("edit horse name → change persists", async ({ page }) => {
        await loginAs(page, USER_A.email, USER_A.password);
        // TODO: click horse → edit → change name → save → verify
    });

    test.skip("delete horse → removed from dashboard", async ({ page }) => {
        await loginAs(page, USER_A.email, USER_A.password);
        // TODO: click horse → delete → confirm → verify gone
    });
});
