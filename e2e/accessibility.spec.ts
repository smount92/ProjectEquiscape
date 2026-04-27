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

    // ── V44 Phase 7: Extended Tier 1 public pages ──────────────

    const TIER_1_PUBLIC_EXTRAS = [
        { path: "/catalog", label: "Catalog" },
        { path: "/market", label: "Market" },
        { path: "/discover", label: "Discover" },
        { path: "/faq", label: "FAQ" },
        { path: "/shows", label: "Shows" },
    ];

    for (const { path, label } of TIER_1_PUBLIC_EXTRAS) {
        test(`${label} has no critical a11y violations`, async ({ page }) => {
            await page.goto(path);
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
                    `Critical a11y violations on ${label}:`,
                    JSON.stringify(
                        critical.map((v) => ({ id: v.id, impact: v.impact, nodes: v.nodes.length })),
                        null,
                        2
                    )
                );
            }
            expect(critical).toHaveLength(0);
        });
    }

    // ── V44 Phase 7: Contrast-specific checks ─────────────────

    test("Public pages pass color-contrast audit", async ({ page }) => {
        const publicPages = ["/login", "/signup", "/faq"];
        for (const route of publicPages) {
            await page.goto(route);
            await page.waitForLoadState("networkidle");

            const results = await new AxeBuilder({ page })
                .withRules(["color-contrast"])
                .analyze();

            const serious = results.violations.filter(
                (v) => v.impact === "critical" || v.impact === "serious"
            );

            expect(
                serious,
                `Serious contrast violations on ${route}`
            ).toHaveLength(0);
        }
    });
});
