/**
 * Server readers for the Registry Desk's lists: the to-do lists (cached),
 * the claims on them (live), and the style rules in effect.
 *
 * The to-do lists are computed from every row of the Registry, the same
 * checks as scripts/catalog-delta/registry_health.mjs (src/lib/registry/
 * checks.ts), and cached for an hour. The cache carries two tags:
 * registryTodo (the Desk's "Check again" button) and referencePages,
 * which every Registry write already clears, so a fix shows on the lists
 * at once. Claims ("I'm on it") are read live on top, never cached.
 *
 * Not a "use server" module: the actions in
 * src/app/actions/registry-desk-lists.ts check the role, then call these.
 */
import "server-only";

import { unstable_cache } from "next/cache";
import { CACHE_TAGS } from "@/lib/cache/tags";
import { createAnonClient } from "@/lib/supabase/anon";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { getAdminClient } from "@/lib/supabase/admin";
import { computeTodoLists, type CheckRow, type TodoList } from "@/lib/registry/checks";
import type { RuleInEffect } from "@/lib/registry/fixes";

type Admin = ReturnType<typeof getAdminClient>;

/**
 * The service-role client without the generated types, for the Desk's
 * tables (242-244), which database.generated.ts doesn't know until the
 * owner pastes them and runs npm run gen-types.
 */
export function deskDb(admin: Admin): SupabaseClient {
    return admin as unknown as SupabaseClient;
}

/** What the Desk says where a list needs update 244. */
export const PENDING_244 = "Coming once update 244 is added.";
/** What History says before update 242. */
export const PENDING_242 = "History starts once update 242 is added.";

/**
 * Does this error mean "that table or column isn't there yet" (a migration
 * not pasted), rather than "it broke"? The codes write.ts detects.
 */
export function isMissingSchema(error: unknown): boolean {
    const code = (error as { code?: string } | null)?.code;
    return (
        code === "42P01" ||
        code === "PGRST205" ||
        code === "PGRST202" ||
        code === "42883" ||
        code === "42703" ||
        code === "PGRST204"
    );
}

/** Items kept per list in the cache (a cache entry must stay well under 2 MB). As rows are fixed, more appear. */
export const TODO_ITEMS_KEPT = 300;
const PAGE = 1000;

export interface CachedTodo {
    computedAt: string;
    lists: TodoList[];
}

/** Every catalog row, with only the attribute keys the checks read. Public data: the anon client. */
async function readRegistryRows(): Promise<CheckRow[]> {
    const db = createAnonClient();
    const out: CheckRow[] = [];
    for (let from = 0; ; from += PAGE) {
        const { data, error } = await db
            .from("catalog_items")
            .select(
                "id, title, item_type, scale, maker, artist, parent_id, color_description:attributes->color_description, model_number:attributes->model_number, release_year_start:attributes->release_year_start, release_year_end:attributes->release_year_end, mold_name:attributes->mold_name",
            )
            .order("id")
            .range(from, from + PAGE - 1);
        if (error) throw new Error(`Registry to-do read: ${error.message}`);
        const rows = (data ?? []) as unknown as (Omit<CheckRow, "attributes"> & Record<string, unknown>)[];
        for (const r of rows) {
            const attributes: Record<string, unknown> = {};
            for (const k of [
                "color_description",
                "model_number",
                "release_year_start",
                "release_year_end",
                "mold_name",
            ]) {
                if (r[k] !== null && r[k] !== undefined) attributes[k] = r[k];
            }
            out.push({
                id: r.id,
                title: r.title ?? "",
                item_type: r.item_type,
                scale: r.scale ?? null,
                maker: r.maker ?? null,
                artist: (r.artist as string | null) ?? null,
                parent_id: r.parent_id ?? null,
                attributes,
            });
        }
        if (rows.length < PAGE) break;
    }
    return out;
}

/** The to-do lists, cached an hour; cleared by any Registry write (referencePages) or "Check again" (registryTodo). */
export const getCachedTodo = unstable_cache(
    async (): Promise<CachedTodo> => {
        const lists = computeTodoLists(await readRegistryRows());
        return {
            computedAt: new Date().toISOString(),
            lists: lists.map((l) => ({ ...l, items: l.items.slice(0, TODO_ITEMS_KEPT) })),
        };
    },
    ["registry:todo:v1"],
    { revalidate: 3600, tags: [CACHE_TAGS.registryTodo, CACHE_TAGS.referencePages] },
);

export interface TodoClaim {
    list_key: string;
    item_key: string;
    claimed_by: string;
    claimed_until: string;
    done_at: string | null;
    alias: string;
}

/** Live claims, with each claimer's alias. `ready: false` before update 244. */
export async function readTodoClaims(
    admin: Admin,
    listKey?: string,
): Promise<{ ready: true; claims: TodoClaim[] } | { ready: false }> {
    let q = deskDb(admin).from("registry_todo_claims").select("list_key, item_key, claimed_by, claimed_until, done_at");
    if (listKey) q = q.eq("list_key", listKey);
    const { data, error } = await q;
    if (error) {
        if (isMissingSchema(error)) return { ready: false };
        throw new Error(`Registry to-do claims: ${(error as { message?: string }).message}`);
    }
    const rows = (data ?? []) as unknown as Omit<TodoClaim, "alias">[];
    const aliases = await aliasesFor(
        admin,
        rows.map((r) => r.claimed_by),
    );
    return { ready: true, claims: rows.map((r) => ({ ...r, alias: aliases.get(r.claimed_by) ?? "a moderator" })) };
}

/** alias_name for a set of user ids, in one read. */
export async function aliasesFor(admin: Admin, ids: (string | null | undefined)[]): Promise<Map<string, string>> {
    const unique = [...new Set(ids.filter((x): x is string => !!x))];
    if (!unique.length) return new Map();
    const { data } = await admin.from("users").select("id, alias_name").in("id", unique);
    return new Map(((data ?? []) as { id: string; alias_name: string }[]).map((u) => [u.id, u.alias_name]));
}

/** The style rules in effect, for the suggested fixes. Empty before update 244. */
export async function readRulesInEffect(admin: Admin): Promise<RuleInEffect[]> {
    const { data, error } = await deskDb(admin)
        .from("registry_style_rules")
        .select("id, title, check_key, params")
        .eq("status", "in_effect");
    if (error) return [];
    return (data ?? []) as unknown as RuleInEffect[];
}
