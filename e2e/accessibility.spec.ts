import { test, expect } from "@playwright/test";
import AxeBuilder from "@axe-core/playwright";
import { loginAs, USER_A } from "./helpers/auth";

test.describe("Accessibility Audit", () => {
    test("landing page has no critical a11y violations", async ({ page }) => {
        await page.goto("/");
        await page.waitForLoadState("networkidle");

        const results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa"])
            .disableRules(["color-contrast", "link-in-text-block"]) // Dark theme + forest-on-stone links cause false positives
            .analyze();

        const critical = results.violations.filter(
            (v) => v.impact === "critical" || v.impact === "serious"
        );

        if (critical.length > 0) {
            console.log(
                "Critical a11y violations on landing:",
                JSON.stringify(
                    critical.map((v) => ({
                        id: v.id,
                        impact: v.impact,
                        description: v.description,
                        nodes: v.nodes.length,
                    })),
                    null,
                    2
                )
            );
        }
        expect(critical).toHaveLength(0);
    });

    test("login page has no critical a11y violations", async ({ page }) => {
        await page.goto("/login");
        await page.waitForLoadState("networkidle");

        const results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa"])
            .disableRules(["color-contrast", "link-in-text-block"])
            .analyze();

        const critical = results.violations.filter(
            (v) => v.impact === "critical" || v.impact === "serious"
        );

        if (critical.length > 0) {
            console.log(
                "Critical a11y violations on login:",
                JSON.stringify(
                    critical.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
                    null,
                    2
                )
            );
        }
        expect(critical).toHaveLength(0);
    });

    test("dashboard has no critical a11y violations", async ({ page }) => {
        await loginAs(page, USER_A.email, USER_A.password);
        await page.goto("/dashboard");
        await page.waitForLoadState("networkidle");

        const results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa"])
            .disableRules(["color-contrast", "link-in-text-block"])
            .analyze();

        const critical = results.violations.filter(
            (v) => v.impact === "critical" || v.impact === "serious"
        );

        if (critical.length > 0) {
            console.log(
                "Critical a11y violations on dashboard:",
                JSON.stringify(
                    critical.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
                    null,
                    2
                )
            );
        }
        expect(critical).toHaveLength(0);
    });

    test("Show Ring has no critical a11y violations", async ({ page }) => {
        await page.goto("/community");
        await page.waitForLoadState("networkidle");

        const results = await new AxeBuilder({ page })
            .withTags(["wcag2a", "wcag2aa"])
            .disableRules(["color-contrast", "link-in-text-block"])
            .analyze();

        const critical = results.violations.filter(
            (v) => v.impact === "critical" || v.impact === "serious"
        );

        if (critical.length > 0) {
            console.log(
                "Critical a11y violations on Show Ring:",
                JSON.stringify(
                    critical.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
                    null,
                    2
                )
            );
        }
        expect(critical).toHaveLength(0);
    });
});
