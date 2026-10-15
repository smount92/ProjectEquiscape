/**
 * Cache tags come from src/lib/cache/tags.ts, never a typed string.
 *
 * A typed tag that no cache carries is a revalidateTag that does nothing,
 * and nothing notices: eleven such calls were found on 2026-10-14. With
 * every tag named from CACHE_TAGS, a clear always targets a real cache.
 */
import { readdirSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const SRC = path.join(process.cwd(), "src");

function sourceFiles(dir: string): string[] {
    return readdirSync(dir).flatMap((name) => {
        const full = path.join(dir, name);
        if (statSync(full).isDirectory()) return name === "__tests__" ? [] : sourceFiles(full);
        return /\.(ts|tsx)$/.test(name) && !/\.test\.tsx?$/.test(name) ? [full] : [];
    });
}

const files = sourceFiles(SRC).map((f) => ({ rel: path.relative(process.cwd(), f).split(path.sep).join("/"), text: readFileSync(f, "utf8") }));

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

});
