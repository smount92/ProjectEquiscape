/**
 * Runtime contrast audit — every visible piece of text, every theme.
 *
 *   npm run test:contrast                       # prod build on :3000
 *   E2E_BASE_URL=http://localhost:3939 npm run test:contrast   # a running dev server
 *   CONTRAST_REPORT_ONLY=1 npm run test:contrast # report, never fail
 *
 * Walks the anonymous routes, then logs in as the test bot and walks the
 * signed-in ones (dashboard, stable, settings, the first horse's passport
 * and edit page) plus /dev/contrast-fixtures, which renders every chip
 * and form variant of the passport with made-up data. Each page is
 * measured in day, night and Simple Mode without a reload — the theme
 * is an attribute on <html>.
 *
 * Output: test-results/contrast/report.json and report.md. The test
 * fails on any failure NOT listed in e2e/contrast.baseline.json; known
 * ones are reported so the list only ever shrinks.
 */
import { expect, test, type Page } from "@playwright/test";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

import { loginAs, USER_A } from "./helpers/auth";

const WALKER = readFileSync(resolve(__dirname, "../scripts/contrast/walker.js"), "utf8");
const BASELINE_PATH = resolve(__dirname, "contrast.baseline.json");
const OUT_DIR = resolve(__dirname, "../test-results/contrast");

type Failure = {
    kind: string;
    text: string;
    path: string;
    fg: string;
    bg: string;
    ratio: number;
    required: number;
    size: number;
    weight: string;
    unverified: boolean;
    imageOn: string | null;
};
type PageReport = { measured: number; failures: Failure[]; unverified: Failure[] };
type Row = Failure & { theme: string; route: string; signature: string; known: boolean };

const ANON_ROUTES = [
    "/",
    "/login",
    "/signup",
    "/forgot-password",
    "/about",
    "/faq",
    "/contact",
    "/privacy",
    "/terms",
    "/getting-started",
    "/learn",
    "/reference",
    "/shows",
    "/calendar",
    "/catalog",
    "/market",
    "/studio",
];

const SIGNED_IN_ROUTES = [
    "/dashboard",
    "/community",
    "/discover",
    "/upgrade",
    "/stable/deleted",
    "/settings",
    "/inbox",
    "/notifications",
    "/favorites",
    "/wishlist",
    "/feed",
    "/add-horse",
    "/studio/setup",
    "/studio/dashboard",
    "/studio/my-commissions",
    "/dev/contrast-fixtures?owner=1",
    "/dev/contrast-fixtures",
];

const THEMES = [
    { name: "day", theme: null, simple: false },
    { name: "night", theme: "night", simple: false },
    { name: "simple", theme: null, simple: true },
];

/** What identifies a failure across runs: theme, route, place, colours. */
function signature(theme: string, route: string, f: Failure): string {
    return [theme, route.split("?")[0], f.kind, f.path, f.fg, f.bg].join("|");
}

async function setTheme(page: Page, theme: string | null, simple: boolean) {
    await page.evaluate(
        ([t, s]) => {
            const html = document.documentElement;
            if (t) html.setAttribute("data-theme", t);
            else html.removeAttribute("data-theme");
            if (s) html.setAttribute("data-simple-mode", "true");
            else html.removeAttribute("data-simple-mode");
        },
        [theme, simple] as const,
    );
    // body cross-fades background-color over 0.35s
    await page.waitForTimeout(450);
}

async function measure(page: Page): Promise<PageReport> {
    // A page that navigates itself (a client redirect, a refresh loop)
    // destroys the evaluation context; settle and try once more.
    for (let attempt = 0; ; attempt++) {
        try {
            await page.evaluate(WALKER);
            return await page.evaluate(() => {
                const w = window as unknown as { __mhhContrast: (o: { quiet: boolean }) => PageReport };
                return w.__mhhContrast({ quiet: true });
            });
        } catch (err) {
            if (attempt >= 1) throw err;
            await page.waitForLoadState("load", { timeout: 8000 }).catch(() => {});
            await page.waitForTimeout(800);
        }
    }
}

/** Open the forms the fixtures page keeps folded, so their labels and placeholders are measured too. */
async function expandFixtures(page: Page) {
    for (const name of ["+ Add Record", "+ Add", "🧬 Add Pedigree"]) {
        const btn = page.getByRole("button", { name, exact: true }).first();
        if (await btn.isVisible().catch(() => false)) await btn.click().catch(() => {});
    }
    await page.waitForTimeout(200);
}

async function visit(page: Page, route: string, expectSignedIn: boolean): Promise<"ok" | "redirected" | "errored"> {
    await page.goto(route, { waitUntil: "domcontentloaded" });
    // Idle is a courtesy, not a requirement: a page that polls never idles.
    await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
    await page.waitForTimeout(300);
    const landed = new URL(page.url()).pathname;
    if (landed === "/login" && route !== "/login" && route !== "/") return "redirected";
    if (expectSignedIn && landed === "/login") return "redirected";
    // The app's error boundary renders perfectly readable text, so a page
    // that threw would otherwise "pass" (the studio settings page did,
    // for a day). Treat it as a page that could not be measured.
    if (await page.getByText("This page didn't load", { exact: false }).count()) return "errored";
    return "ok";
}

test.describe("contrast audit", () => {
    test.setTimeout(15 * 60 * 1000);

    test("every visible text reads at AA in day, night and Simple Mode", async ({ page }) => {
        const baseline: { known: string[] } = existsSync(BASELINE_PATH) ? JSON.parse(readFileSync(BASELINE_PATH, "utf8")) : { known: [] };
        const known = new Set(baseline.known);
        const rows: Row[] = [];
        const unverified: Row[] = [];
        const skipped: string[] = [];
        let measured = 0;

        const audit = async (route: string, signedIn: boolean) => {
            try {
                const landed = await visit(page, route, signedIn);
                if (landed === "redirected") {
                    skipped.push(`${route} (redirected to /login)`);
                    return;
                }
                if (landed === "errored") {
                    skipped.push(`${route} (could not measure: the page threw and showed the error boundary)`);
                    return;
                }
                if (route.startsWith("/dev/contrast-fixtures?owner=1")) await expandFixtures(page);
                for (const t of THEMES) {
                    await setTheme(page, t.theme, t.simple);
                    const report = await measure(page);
                    measured += report.measured;
                    for (const f of report.failures) {
                        const sig = signature(t.name, route, f);
                        rows.push({ ...f, theme: t.name, route, signature: sig, known: known.has(sig) });
                    }
                    for (const f of report.unverified) unverified.push({ ...f, theme: t.name, route, signature: signature(t.name, route, f), known: false });
                }
                await setTheme(page, null, false).catch(() => {});
            } catch (err) {
                // One page's trouble must not hide every other page's result.
                const reason = err instanceof Error ? err.message.split(/\r?\n/)[0] : String(err);
                skipped.push(`${route} (could not measure: ${reason})`);
            }
        };

        for (const route of ANON_ROUTES) await audit(route, false);

        await loginAs(page, USER_A.email, USER_A.password);
        const routes = [...SIGNED_IN_ROUTES];
        // The bot's first horse: its stable page, its edit page, its public passport.
        await page.goto("/dashboard", { waitUntil: "domcontentloaded" });
        await page.waitForLoadState("networkidle", { timeout: 8000 }).catch(() => {});
        const href = await page
            .locator('a[href^="/stable/"]')
            .evaluateAll((as) => (as as HTMLAnchorElement[]).map((a) => a.getAttribute("href") || "").find((h) => /^\/stable\/[0-9a-f-]{36}$/.test(h)) ?? null);
        if (href) {
            const id = href.split("/")[2];
            routes.push(`/stable/${id}`, `/stable/${id}/edit`, `/community/${id}`);
        } else {
            skipped.push("(the test bot has no horse — passport pages with real data not measured)");
        }
        for (const route of routes) await audit(route, true);

        // ── Report ──
        mkdirSync(OUT_DIR, { recursive: true });
        const fresh = rows.filter((r) => !r.known);
        const stillKnown = rows.filter((r) => r.known);
        const fixed = [...known].filter((sig) => !rows.some((r) => r.signature === sig));
        writeFileSync(
            resolve(OUT_DIR, "report.json"),
            JSON.stringify({ measured, fresh, stillKnown, fixedBaselineEntries: fixed, unverified, skipped }, null, 2),
        );
        const md: string[] = [
            `# Contrast audit`,
            ``,
            `Measured ${measured} text nodes. **${fresh.length} new failures**, ${stillKnown.length} known (baseline), ${fixed.length} baseline entries no longer failing, ${unverified.length} unverifiable (text on a photo or unknown gradient).`,
            ``,
        ];
        const group = (title: string, list: Row[]) => {
            if (list.length === 0) return;
            md.push(`## ${title}`, ``);
            const byTheme = new Map<string, Row[]>();
            for (const r of list) byTheme.set(r.theme, [...(byTheme.get(r.theme) ?? []), r]);
            for (const [theme, items] of byTheme) {
                md.push(`### ${theme}`, ``, `| ratio | needs | ink | ground | text | where | route |`, `|---|---|---|---|---|---|---|`);
                for (const r of items) md.push(`| ${r.ratio} | ${r.required} | ${r.fg} | ${r.bg} | ${r.text.replace(/\|/g, "/")} | \`${r.path.replace(/\|/g, "/")}\` | ${r.route} |`);
                md.push(``);
            }
        };
        group("New failures", fresh);
        group("Known failures (in baseline)", stillKnown);
        group("Unverifiable (estimate only)", unverified);
        if (fixed.length) md.push(`## Fixed — remove from e2e/contrast.baseline.json`, ``, ...fixed.map((s) => `- \`${s}\``), ``);
        if (skipped.length) md.push(`## Skipped`, ``, ...skipped.map((s) => `- ${s}`), ``);
        writeFileSync(resolve(OUT_DIR, "report.md"), md.join("\n"));

        console.log(`[contrast] ${measured} measured · ${fresh.length} new failures · ${stillKnown.length} known · ${fixed.length} fixed · ${unverified.length} unverifiable · ${skipped.length} skipped`);
        for (const r of fresh.slice(0, 40)) console.log(`  ${r.theme.padEnd(6)} ${String(r.ratio).padStart(5)} (needs ${r.required}) ${r.fg} on ${r.bg}  "${r.text}"  ${r.route}  ${r.path}`);
        if (fresh.length > 40) console.log(`  … ${fresh.length - 40} more in test-results/contrast/report.md`);
        for (const s of skipped) console.log(`  skipped: ${s}`);

        expect(measured, "nothing measured — is the server up and the walker intact?").toBeGreaterThan(200);
        expect(skipped.filter((s) => s.includes("could not measure")), "pages that could not be measured").toEqual([]);
        if (process.env.CONTRAST_REPORT_ONLY !== "1") {
            expect(fresh.map((r) => `${r.theme} ${r.route} ${r.ratio}:1 ${r.fg}/${r.bg} "${r.text}" ${r.path}`), "new contrast failures — see test-results/contrast/report.md").toEqual([]);
        }
    });
});
