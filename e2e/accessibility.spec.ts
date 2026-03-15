import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { loginAs, USER_A } from "./helpers/auth";

test.describe("Accessibility Audit", () => {
    test("landing page has no critical a11y violations", async ({ page }) => {
        await page.goto("/");
        const results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa"])
            .disableRules(["color-contrast"]) // Dark theme causes false positives
            .analyze();

        const critical = results.violations.filter(
            (v) => v.impact === "critical" || v.impact === "serious"
        );

        if (critical.length > 0) {
            console.log("Critical a11y violations:", JSON.stringify(critical, null, 2));
        }
        expect(critical).toHaveLength(0);
    });

    test("login page has no critical a11y violations", async ({ page }) => {
        await page.goto("/login");
        const results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa"])
            .disableRules(["color-contrast"])
            .analyze();

        const critical = results.violations.filter(
            (v) => v.impact === "critical" || v.impact === "serious"
        );
        expect(critical).toHaveLength(0);
    });

    test("dashboard has no critical a11y violations", async ({ page }) => {
        await loginAs(page, USER_A.email, USER_A.password);
        await page.goto("/dashboard");
        await page.waitForLoadState("networkidle");

        const results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa"])
            .disableRules(["color-contrast"])
            .analyze();

        const critical = results.violations.filter(
            (v) => v.impact === "critical" || v.impact === "serious"
        );
        expect(critical).toHaveLength(0);
    });

    test("Show Ring (public) has no critical a11y violations", async ({ page }) => {
        await page.goto("/community");
        const results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa"])
            .disableRules(["color-contrast"])
            .analyze();

        const critical = results.violations.filter(
            (v) => v.impact === "critical" || v.impact === "serious"
        );
        expect(critical).toHaveLength(0);
    });
});
