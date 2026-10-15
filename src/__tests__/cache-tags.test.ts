/**
 * Cache tags come from src/lib/cache/tags.ts, never a typed string, and
 * every tag is both carried by a cache and cleared by something.
 *
 * A typed tag that no cache carries is a revalidateTag that does nothing,
 * and nothing notices: eleven such calls were found on 2026-10-14. A tag
 * carried but never cleared is a cache that only time refreshes.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { CACHE_TAGS } from "@/lib/cache/tags";

const SRC = path.join(process.cwd(), "src");

function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) return name === "__tests__" ? [] : sourceFiles(full);
        return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
    });
}

const files = sourceFiles(SRC).map((f) => ({ rel: path.relative(process.cwd(), f).split(path.sep).join("/"), text: readFileSync(f, "utf8") }));
const all = files.map((f) => f.text).join("\n");

/** Tags refreshed only by time, on purpose. */
const TIME_ONLY: Record<string, string> = {
    publicStats: "home-page counts; an hour old is fine",
};

/** Every way a file can name a tag: CACHE_TAGS.key, or a constant set to it. */
function namesFor(key: string): string[] {
    const aliases = [...all.matchAll(new RegExp(`(?:const|let)\\s+(\\w+)\\s*=\\s*CACHE_TAGS\\.${key}\\b`, "g"))].map((m) => m[1]);
    return [`CACHE_TAGS.${key}`, ...aliases];
}

describe("cache tags", () => {
    it("revalidateTag never takes a typed string", () => {
        const typed = files.flatMap(({ rel, text }) =>
            [...text.matchAll(/revalidateTag\(\s*(["'`][^"'`]*["'`])/g)].map((m) => `${rel}: ${m[1]}`),
        );
        expect(typed).toEqual([]);
    });

    it("a cache's tags list never holds a typed string", () => {
        const typed = files.flatMap(({ rel, text }) =>
            [...text.matchAll(/tags:\s*\[([^\]]*)\]/g)]
                .filter((m) => /["'`]/.test(m[1]))
                .map((m) => `${rel}: tags: [${m[1].trim()}]`),
        );
        expect(typed).toEqual([]);
    });

    it("every tag is carried by a cache", () => {
        const uncarried = Object.keys(CACHE_TAGS).filter(
            (key) => !namesFor(key).some((n) => new RegExp(`tags:\\s*\\[[^\\]]*\\b${n.replace(".", "\\.")}\\b`).test(all)),
        );
        expect(uncarried).toEqual([]);
    });

    it("every tag is cleared by something, unless it is refreshed by time on purpose", () => {
        const uncleared = Object.keys(CACHE_TAGS).filter(
            (key) => !(key in TIME_ONLY) && !namesFor(key).some((n) => new RegExp(`revalidateTag\\(\\s*${n.replace(".", "\\.")}\\b`).test(all)),
        );
        expect(uncleared).toEqual([]);
    });
});
