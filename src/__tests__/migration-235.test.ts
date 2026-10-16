/**
 * Migration 235 re-creates four existing functions. Permission and logic
 * regressions have ridden in on bug-fix migrations before (docs/STANDARDS.md,
 * the add-migration skill), so this pins each one to its previous
 * definition: take away exactly the lines 235 adds, and what is left must be
 * the old body, word for word. The grants must be restated too.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const read = (file: string) => readFileSync(path.join(process.cwd(), "supabase", "migrations", file), "utf8");
const M235 = read("235_report_targets.sql");

/** SQL without comments, whitespace collapsed. */
const flat = (sql: string) => sql.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim();

/** One function's definition, from CREATE OR REPLACE to the end of its body. */
function definition(sql: string, name: string): string {
    const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
    if (start < 0) throw new Error(`${name} not found`);
    const open = sql.indexOf("$$", start);
    const close = sql.indexOf("$$", open + 2);
    return flat(sql.slice(start, close + 2));
}

const REPLACED: { name: string; from: string; added: string[] }[] = [
    {
        name: "messages_guard",
        from: "173_deal_room.sql",
        added: [
            "IF NEW.deleted_at IS DISTINCT FROM OLD.deleted_at THEN RAISE EXCEPTION 'Only the site team can remove a message or restore a removed one.'; END IF;",
        ],
    },
    {
        name: "get_public_hoofprint",
        from: "177_public_hoofprint_rpc.sql",
        added: ["AND p.hidden_at IS NULL"],
    },
    {
        name: "toggle_post_like",
        from: "133_security_hardening.sql",
        added: [
            "IF EXISTS (SELECT 1 FROM public.posts WHERE id = p_post_id AND hidden_at IS NOT NULL) THEN RAISE EXCEPTION 'This post is no longer available.'; END IF;",
        ],
    },
    {
        name: "add_post_reply",
        from: "133_security_hardening.sql",
        added: [
            "IF EXISTS (SELECT 1 FROM public.posts WHERE id = p_parent_id AND hidden_at IS NOT NULL) THEN RAISE EXCEPTION 'This post is no longer available.'; END IF;",
        ],
    },
];

describe("migration 235 re-creates functions from their latest definitions", () => {
    it.each(REPLACED)("$name is $from's body plus only the 235 check", ({ name, from, added }) => {
        let mine = definition(M235, name);
        for (const line of added) {
            const bit = flat(line);
            expect(mine).toContain(bit);
            mine = mine.replace(bit, "").replace(/\s+/g, " ");
        }
        expect(mine).toBe(definition(read(from), name).replace(/\s+/g, " "));
    });

    it("keeps every grant and revoke the replaced functions had", () => {
        const code = flat(M235);
        for (const line of [
            "REVOKE ALL ON FUNCTION public.get_public_hoofprint(UUID) FROM PUBLIC;",
            "GRANT EXECUTE ON FUNCTION public.get_public_hoofprint(UUID) TO anon, authenticated;",
            "REVOKE EXECUTE ON FUNCTION public.toggle_post_like(UUID, UUID) FROM PUBLIC, anon;",
            "REVOKE EXECUTE ON FUNCTION public.add_post_reply(UUID, UUID, TEXT, UUID, UUID, UUID) FROM PUBLIC, anon;",
            "GRANT EXECUTE ON FUNCTION public.toggle_post_like(UUID, UUID) TO authenticated;",
            "GRANT EXECUTE ON FUNCTION public.add_post_reply(UUID, UUID, TEXT, UUID, UUID, UUID) TO authenticated;",
        ]) {
            expect(code).toContain(line);
        }
    });

    it("lets the service role (no member session) through every new guard, so take-downs and undoing them work", () => {
        for (const name of ["user_horses_moderation_guard", "show_class_entries_moderation_guard"]) {
            expect(definition(M235, name)).toContain("IF (SELECT auth.uid()) IS NULL THEN RETURN NEW; END IF;");
        }
        expect(definition(M235, "messages_guard")).toContain("IF v_uid IS NULL THEN RETURN NEW; END IF;");
    });

    it("says the same words in the horse guard as the app does", async () => {
        const { MODERATION_HOLD_MESSAGE } = await import("@/lib/moderation/horseHold");
        expect(definition(M235, "user_horses_moderation_guard")).toContain(`'${MODERATION_HOLD_MESSAGE}'`);
    });
});
