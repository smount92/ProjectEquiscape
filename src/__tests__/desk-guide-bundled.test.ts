/**
 * The Desk's guide page reads docs/guides/registry-moderation.md from disk
 * at request time. Vercel only ships the files a route is traced to use,
 * and a path built with process.cwd() isn't traced, so next.config names
 * the file for that route; without it the page would show its "could not
 * be opened" fallback in production only.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const root = process.cwd();
const config = readFileSync(path.join(root, "next.config.ts"), "utf8");
const page = readFileSync(path.join(root, "src", "app", "catalog", "desk", "guide", "page.tsx"), "utf8");

describe("the moderators' guide ships with the site", () => {
    it("reads the file the config bundles", () => {
        expect(page).toContain('path.join(process.cwd(), "docs", "guides", "registry-moderation.md")');
        expect(existsSync(path.join(root, "docs", "guides", "registry-moderation.md"))).toBe(true);
    });

    it("next.config traces the guide file into the guide route", () => {
        expect(config).toMatch(/outputFileTracingIncludes:\s*\{/);
        expect(config).toMatch(/"\/catalog\/desk\/guide":\s*\[\s*"\.\/docs\/guides\/registry-moderation\.md"\s*\]/);
    });

    it("keeps the polite fallback when the file can't be read", () => {
        expect(page).toMatch(/The guide could not be opened just now/);
    });
});
