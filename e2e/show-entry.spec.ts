import { test, expect } from "@playwright/test";
import { loginAs, USER_A } from "./helpers/auth";

test.describe("Show Entry Flow", () => {
    test.skip("add show record to horse → appears in timeline", async ({ page }) => {
        await loginAs(page, USER_A.email, USER_A.password);
        // TODO: Navigate to a horse passport → "Add Record"
        // Fill: show name, class name, placing → save
        // Verify: record appears in timeline with correct data
    });

    test.skip("edit show record notes → can clear to empty (regression)", async ({ page }) => {
        await loginAs(page, USER_A.email, USER_A.password);
        // TODO: Navigate to existing show record → edit → clear notes → save
        // Verify: notes field is empty after reload (regression test for deletion bug)
    });
});
