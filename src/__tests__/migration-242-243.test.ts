/**
 * Migrations 242 and 243 (Registry Desk Phase 1), read as text.
 *
 * The owner pastes these by hand, so the checks that matter are made here
 * before anything reaches the database: nobody but the server can run the
 * functions; a merge moves every table that points at a Registry row (a
 * table it forgot would be cascade-deleted or block the delete); an
 * unmerge moves a link back only while it still points at the kept row;
 * re-inserted rows name their columns and never the generated ones; and
 * the History words in code match the CHECK lists in the database.
 */
import { readdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { ACTION_KINDS, ACTION_STATUSES, ACTOR_ROLES, MODERATOR_STATUSES, ROW_OUTCOMES } from "@/lib/registry/types";

const DIR = path.join(process.cwd(), "supabase", "migrations");
const read = (f: string) => readFileSync(path.join(DIR, f), "utf8");
const M242 = read("242_registry_moderators.sql");
const M243 = read("243_registry_merge_undo.sql");

/** SQL without comments, whitespace collapsed. */
const flat = (sql: string) => sql.replace(/--.*$/gm, "").replace(/\s+/g, " ").trim();

/** One function's body, from CREATE OR REPLACE to the closing $$. */
function body(sql: string, name: string): string {
    const start = sql.indexOf(`CREATE OR REPLACE FUNCTION public.${name}(`);
    if (start < 0) throw new Error(`${name} not found`);
    const open = sql.indexOf("$$", start);
    const close = sql.indexOf("$$", open + 2);
    return flat(sql.slice(start, close + 2));
}

/** The values of a CHECK (col IN (...)) on one column. */
function checkValues(sql: string, column: string): string[] {
    const m = flat(sql).match(new RegExp(`${column}[^;]*?CHECK \\(${column} IN \\(([^)]*)\\)`));
    if (!m) throw new Error(`no CHECK on ${column}`);
    return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
}

const FUNCTIONS = [
    "registry_link_counts(UUID)",
    "registry_merge(UUID, UUID, UUID, UUID, TEXT)",
    "registry_reinsert_item(JSONB)",
    "registry_unmerge(UUID, UUID)",
    "registry_remove(UUID, UUID, UUID, TEXT)",
    "registry_restore(UUID, UUID)",
];

/**
 * Every table with a foreign key to catalog_items, from every migration.
 * The merge must move each, unless its rows are machine data that is
 * re-collected (price signals, history, sweeps) or the address history,
 * which the merge handles on its own.
 */
function tablesReferencingCatalogItems(): Set<string> {
    const found = new Set<string>();
    for (const f of readdirSync(DIR).filter((x) => x.endsWith(".sql"))) {
        let current = "";
        for (const line of read(f).split("\n")) {
            const code = line.replace(/--.*$/, "");
            const t = code.match(/\b(?:CREATE TABLE(?: IF NOT EXISTS)?|ALTER TABLE)\s+(?:public\.)?(\w+)/i);
            if (t) current = t[1];
            if (/REFERENCES\s+(?:public\.)?catalog_items\b/i.test(code) && current) found.add(current);
        }
    }
    return found;
}

const MACHINE_DATA = new Set(["catalog_price_signals", "catalog_price_history", "catalog_price_sweeps"]);

describe("migration 242", () => {
    it("adds no foreign key from catalog_changelog to catalog_items (the changelog page embed)", () => {
        const changelogLines = M242.split("\n").filter((l) => /catalog_changelog/.test(l) || /ADD COLUMN/.test(l));
        expect(changelogLines.some((l) => /REFERENCES\s+(public\.)?catalog_items/i.test(l))).toBe(false);
        expect(flat(M242)).toMatch(
            /ADD COLUMN IF NOT EXISTS action_id UUID REFERENCES public\.registry_actions\(id\) ON DELETE SET NULL/,
        );
    });

    it("leaves catalog_suggestions.claimed_by without a foreign key", () => {
        expect(flat(M242)).toMatch(/ADD COLUMN IF NOT EXISTS claimed_by UUID;/);
    });

    it("widens the changelog's change types from 228's list", () => {
        const m228 = checkValues(read("228_duplicate_suggestions.sql"), "change_type");
        const m242 = checkValues(M242, "change_type");
        expect(m242).toEqual([...m228, "merge", "restore", "revert"]);
    });

    it("History words in code match the database's CHECK lists", () => {
        expect(checkValues(M242, "kind")).toEqual([...ACTION_KINDS]);
        expect(checkValues(M242, "actor_role")).toEqual([...ACTOR_ROLES]);
        expect(checkValues(M242, "outcome")).toEqual([...ROW_OUTCOMES]);
        expect(flat(M242)).toContain(`CHECK (status IN (${MODERATOR_STATUSES.map((s) => `'${s}'`).join(", ")}))`);
        expect(flat(M242)).toContain(`CHECK (status IN (${ACTION_STATUSES.map((s) => `'${s}'`).join(", ")}))`);
    });

    it("only the server sets a suggestion's claim, original wording and deciding role", () => {
        const guard = body(M242, "catalog_suggestions_guard_review_cols");
        // Told apart the way 142, 176 and 180 do it: the request's role.
        expect(guard).toMatch(/IF current_user IN \('anon', 'authenticated'\) THEN/);
        expect(guard).toMatch(/SECURITY INVOKER/);
        for (const col of ["claimed_by", "claimed_until", "original_field_changes", "decided_role"]) {
            expect(guard, col).toContain(`NEW.${col} IS DISTINCT FROM OLD.${col}`);
            expect(guard, col).toContain(`NEW.${col} IS NOT NULL`);
        }
        expect(guard).toMatch(/RAISE EXCEPTION/);
        const code = flat(M242);
        expect(code).toMatch(
            /DROP TRIGGER IF EXISTS trg_catalog_suggestions_guard_review_cols ON public\.catalog_suggestions; CREATE TRIGGER trg_catalog_suggestions_guard_review_cols BEFORE INSERT OR UPDATE ON public\.catalog_suggestions/,
        );
    });

    it("History kinds and statuses are widened by name, so a second paste takes the new lists", () => {
        const code = flat(M242);
        expect(code).toContain("DROP CONSTRAINT IF EXISTS registry_actions_kind_check");
        expect(code).toContain("DROP CONSTRAINT IF EXISTS registry_actions_status_check");
        expect(ACTION_KINDS).toContain("reject");
        expect(ACTION_STATUSES).toContain("pending");
    });

    it("new tables have row security and no policies", () => {
        for (const t of ["registry_moderators", "registry_actions", "registry_action_rows"]) {
            expect(M242).toContain(`ALTER TABLE public.${t} ENABLE ROW LEVEL SECURITY;`);
        }
        expect(M242).not.toMatch(/CREATE POLICY/i);
    });
});

describe("migration 243", () => {
    it.each(FUNCTIONS)("%s is for the server only", (fn) => {
        expect(M243).toContain(`REVOKE ALL ON FUNCTION public.${fn} FROM PUBLIC, anon, authenticated;`);
        expect(M243).toContain(`GRANT EXECUTE ON FUNCTION public.${fn} TO service_role;`);
    });

    it("every function is SECURITY DEFINER with an empty search_path", () => {
        const heads = [...M243.matchAll(/CREATE OR REPLACE FUNCTION public\.(\w+)\([\s\S]*?\$\$/g)].map((m) =>
            flat(m[0]),
        );
        expect(heads).toHaveLength(FUNCTIONS.length);
        for (const head of heads) expect(head).toMatch(/SECURITY DEFINER SET search_path = ''/);
    });

    it("the merge moves every table that points at a Registry row", () => {
        const merge = body(M243, "registry_merge");
        const referencing = tablesReferencingCatalogItems();
        const moved = [...referencing].filter((t) => !MACHINE_DATA.has(t) && t !== "catalog_slug_history");
        expect(moved.length).toBeGreaterThanOrEqual(8);
        for (const t of moved) expect(merge, t).toMatch(new RegExp(`UPDATE public\\.${t} SET \\w+ = p_keep`));
        expect(merge).toMatch(/UPDATE public\.catalog_slug_history SET item_id = p_keep/);
        // The machine data is the only thing left to cascade.
        expect([...referencing].filter((t) => !moved.includes(t)).sort()).toEqual(
            ["catalog_price_history", "catalog_price_signals", "catalog_price_sweeps", "catalog_slug_history"].filter(
                (t) => referencing.has(t),
            ),
        );
    });

    it("a merge runs once: its History entry is locked first and 'already applied' comes before 'missing'", () => {
        const merge = body(M243, "registry_merge");
        const lock = merge.indexOf(
            "SELECT * INTO v_action FROM public.registry_actions WHERE id = p_action_id FOR UPDATE",
        );
        expect(lock).toBeGreaterThan(0);
        const applied = merge.indexOf("RAISE EXCEPTION 'already_applied'");
        const missing = merge.indexOf("RAISE EXCEPTION 'missing'");
        const rowsLocked = merge.indexOf(
            "FROM public.catalog_items WHERE id IN (p_keep, p_remove) ORDER BY id FOR UPDATE",
        );
        expect(lock).toBeLessThan(applied);
        expect(applied).toBeLessThan(missing);
        expect(lock).toBeLessThan(rowsLocked);
        // Only a merge waiting for its second look, or the owner's pending one.
        expect(merge).toMatch(/IF v_action\.status NOT IN \('awaiting_second_look', 'pending'\) THEN/);
        expect(merge).toMatch(/v_action\.applied_at IS NOT NULL/);
        // The confirmer is stamped inside the merge's own transaction.
        expect(merge).toMatch(/second_look_by = CASE WHEN v_action\.status = 'awaiting_second_look' THEN p_actor/);
    });

    it("a removal turns its pending History entry applied, once", () => {
        const remove = body(M243, "registry_remove");
        expect(remove).toMatch(/FROM public\.registry_actions WHERE id = p_action_id FOR UPDATE/);
        expect(remove).toMatch(/v_action\.status <> 'pending'/);
    });

    it("merging two molds moves the releases to the kept mold's scale, and the unmerge puts the old scales back", () => {
        const merge = body(M243, "registry_merge");
        expect(merge).toMatch(/SET parent_id = p_keep, scale = coalesce\(v_keep\.scale, scale\)/);
        // Each old scale is a History row, so the unmerge can read it back.
        expect(merge).toMatch(/jsonb_build_object\('scale', e->1\), jsonb_build_object\('scale', v_keep\.scale\)/);
        const unmerge = body(M243, "registry_unmerge");
        expect(unmerge).toMatch(/UPDATE public\.catalog_items c SET scale = rr\.before->>'scale'/);
        // Expect-guarded: only releases filed under the restored mold that still hold the merged scale.
        expect(unmerge).toMatch(/c\.parent_id = v_item AND c\.scale IS NOT DISTINCT FROM rr\.after->>'scale'/);
    });

    it("the unmerge moves each link back only while it still points at the kept row", () => {
        const unmerge = body(M243, "registry_unmerge");
        const pairs: [string, string][] = [
            ["user_horses", "catalog_id"],
            ["user_wishlists", "catalog_id"],
            ["id_suggestions", "catalog_id"],
            ["catalog_suggestions", "catalog_item_id"],
            ["catalog_changelog", "catalog_item_id"],
            ["catalog_items", "parent_id"],
            ["catalog_sale_reports", "catalog_item_id"],
            ["catalog_price_signal_flags", "catalog_item_id"],
        ];
        for (const [t, c] of pairs) {
            expect(unmerge, t).toMatch(
                new RegExp(`UPDATE public\\.${t} SET ${c} = v_item WHERE id = ANY\\(v_ids\\) AND ${c} = v_keep`),
            );
        }
        expect(unmerge).toMatch(/too_late/);
        expect(unmerge).toMatch(/already_undone/);
    });

    it("re-inserts name their columns and never the generated ones", () => {
        const reinsert = body(M243, "registry_reinsert_item");
        const cols = reinsert.match(/INSERT INTO public\.catalog_items \(([^)]*)\)/)?.[1] ?? "";
        expect(cols.split(",").map((c) => c.trim())).toEqual([
            "id",
            "item_type",
            "parent_id",
            "title",
            "maker",
            "maker_slug",
            "slug",
            "scale",
            "attributes",
            "artist",
            "manufacturer",
            "created_at",
        ]);
        expect(reinsert).not.toMatch(/sort_key|search_key/);
        // A taken address gets a new one from the 129 trigger; a lost mold leaves it unfiled.
        expect(reinsert).toMatch(/v_slug := NULL/);
        expect(reinsert).toMatch(/v_parent := NULL/);
        // The archived row drops the generated columns.
        expect(flat(M243).match(/- 'sort_key' - 'search_key'/g)?.length).toBe(2);
    });

    it("removal refuses a linked row with the counts, and frees the changelog first", () => {
        const remove = body(M243, "registry_remove");
        expect(remove).toMatch(/RAISE EXCEPTION 'linked' USING DETAIL = v_counts::text/);
        expect(remove).toMatch(
            /UPDATE public\.catalog_changelog SET catalog_item_id = NULL WHERE catalog_item_id = p_item/,
        );
        expect(remove.indexOf("registry_link_counts")).toBeLessThan(remove.indexOf("DELETE FROM public.catalog_items"));
    });

    it("link counts cover horses (deleted ones too), want lists, releases, Help ID, suggestions, sales and flags", () => {
        const counts = body(M243, "registry_link_counts");
        for (const key of [
            "horses",
            "wishlists",
            "children",
            "id_suggestions",
            "pending_suggestions",
            "sale_reports",
            "price_flags",
        ])
            expect(counts).toContain(`'${key}'`);
        expect(counts).not.toMatch(/deleted_at/);
    });

    it("adds no foreign key to catalog_items anywhere", () => {
        expect(M243).not.toMatch(/REFERENCES\s+(public\.)?catalog_items/i);
    });
});

describe("lock timeouts", () => {
    // A paste that waits on a busy table stops after 5 seconds instead of
    // queueing every member's request behind it; the header says to paste again.
    it.each(["240_registry_search_key.sql", "242_registry_moderators.sql", "243_registry_merge_undo.sql"])(
        "%s sets a lock timeout before its first statement and resets it after",
        (f) => {
            const sql = read(f);
            const code = flat(sql);
            expect(code.startsWith("SET lock_timeout = '5s';"), f).toBe(true);
            expect(code).toContain("RESET lock_timeout;");
            const header = sql.replace(/\r?\n--\s*/g, " ");
            expect(header).toMatch(/lock timeout/i);
            expect(header).toMatch(/paste it again a minute later/i);
        },
    );
});
