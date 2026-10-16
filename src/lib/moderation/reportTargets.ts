import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { fail, safeError, type ActionResult } from "@/lib/actions/result";
import { REPORT_TAKE_DOWN_LABEL, type ReportTargetType, type ReportTargetView } from "@/lib/moderation/reports";

/**
 * What a reported thing is, and how to take it down: the one place that
 * knows where each kind of content lives.
 *
 * Both halves run on the service-role client, behind requireAdmin() in
 * src/app/actions/moderation.ts. RLS can't serve them: the admin is rarely
 * a party to the content (a private message, a private barn's thread) and
 * hidden rows are invisible to every member, the admin included.
 *
 * Nothing here deletes member data. Take-downs hide, mark removed, make
 * private or scratch, so every one can be undone from the database.
 */

/** Untyped on purpose: hidden_at / hidden_by (migration 235) postdate the generated types. */
type Db = SupabaseClient;

export const targetKey = (type: string, id: string) => `${type}:${id}`;

const EXCERPT = 160;

export function excerpt(text: string | null | undefined, max = EXCERPT): string {
    const flat = (text ?? "").replace(/\s+/g, " ").trim();
    return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

const GONE: ReportTargetView = {
    summary: "This has since been deleted.",
    href: null,
    ownerId: null,
    ownerAlias: null,
    state: "Gone",
    takeDownLabel: null,
};

type Row = Record<string, unknown>;

async function rowsById(db: Db, table: string, columns: string, ids: string[]): Promise<Map<string, Row>> {
    const map = new Map<string, Row>();
    if (ids.length === 0) return map;
    const { data, error } = await db.from(table).select(columns).in("id", ids);
    if (error) return map;
    for (const r of (data ?? []) as unknown as Row[]) map.set(r.id as string, r);
    return map;
}

const str = (v: unknown) => (typeof v === "string" ? v : null);

/** Kinds of thing that are hidden with hidden_at (migration 235). */
export const HIDEABLE: Partial<Record<ReportTargetType, { table: string; owner: string }>> = {
    post: { table: "posts", owner: "author_id" },
    comment: { table: "posts", owner: "author_id" },
    id_request: { table: "id_requests", owner: "user_id" },
    id_suggestion: { table: "id_suggestions", owner: "user_id" },
};

const LISTED = ["For Sale", "Open to Offers"];
const RESULTS_FINAL = ["results_review", "completed", "archived"];
const REMOVABLE_MESSAGE_KINDS = ["chat", "photo"];

/**
 * Describe every reported target in one pass (a query per kind, not per
 * report). Keyed by targetKey(type, id). A target that no longer exists
 * comes back as "Gone" rather than missing, so every card can render.
 */
export async function describeReportTargets(
    db: Db,
    targets: { targetType: string; targetId: string }[],
): Promise<Map<string, ReportTargetView>> {
    const idsOf = (...types: string[]) => [
        ...new Set(targets.filter((t) => types.includes(t.targetType)).map((t) => t.targetId)),
    ];

    const [posts, horses, users, messages, entries, requests, suggestions] = await Promise.all([
        rowsById(db, "posts", "*", idsOf("post", "comment")),
        rowsById(db, "user_horses", "id, custom_name, owner_id, visibility, trade_status, deleted_at", idsOf("horse")),
        rowsById(db, "users", "id, alias_name, is_suspended", idsOf("user")),
        rowsById(db, "messages", "*", idsOf("message")),
        rowsById(db, "show_class_entries", "id, horse_id, owner_id, show_id, class_id, status", idsOf("show_entry")),
        rowsById(db, "id_requests", "*", idsOf("id_request")),
        rowsById(db, "id_suggestions", "*", idsOf("id_suggestion")),
    ]);

    // Second hop: barn slugs for thread links, and the names a show entry needs.
    const groupIds = [...posts.values()].map((p) => str(p.group_id)).filter((x): x is string => !!x);
    const entryRows = [...entries.values()];
    const [groups, entryHorses, shows, classes] = await Promise.all([
        rowsById(db, "groups", "id, slug", [...new Set(groupIds)]),
        rowsById(db, "user_horses", "id, custom_name", [...new Set(entryRows.map((e) => e.horse_id as string))]),
        rowsById(db, "shows", "id, title, status", [...new Set(entryRows.map((e) => e.show_id as string))]),
        rowsById(db, "show_classes", "id, name", [...new Set(entryRows.map((e) => e.class_id as string))]),
    ]);

    const views = new Map<string, Omit<ReportTargetView, "ownerAlias">>();
    for (const t of targets) {
        const key = targetKey(t.targetType, t.targetId);
        const type = t.targetType as ReportTargetType;
        const label = REPORT_TAKE_DOWN_LABEL[type] ?? null;
        let view: Omit<ReportTargetView, "ownerAlias"> | null = null;

        if (type === "post" || type === "comment") {
            const p = posts.get(t.targetId);
            if (p) {
                const root = (type === "comment" ? str(p.parent_id) : null) ?? t.targetId;
                const slug = str(groups.get(str(p.group_id) ?? "")?.slug);
                const title = str(p.title);
                view = {
                    summary: title ? `${title}: ${excerpt(str(p.content), 120)}` : excerpt(str(p.content)),
                    href: slug ? `/community/groups/${slug}/thread/${root}` : `/feed/${root}`,
                    ownerId: str(p.author_id),
                    state: p.hidden_at ? "Hidden" : null,
                    takeDownLabel: p.hidden_at ? null : label,
                };
            }
        } else if (type === "horse") {
            const h = horses.get(t.targetId);
            if (h) {
                const listed = LISTED.includes(str(h.trade_status) ?? "");
                const isPrivate = h.visibility === "private";
                view = {
                    summary: `${str(h.custom_name) ?? "Unnamed horse"}${listed ? " (listed for sale)" : ""}`,
                    href: `/community/${t.targetId}`,
                    ownerId: str(h.owner_id),
                    state: h.deleted_at ? "Deleted by its owner" : isPrivate ? "Private" : null,
                    takeDownLabel: h.deleted_at || isPrivate ? null : label,
                };
            }
        } else if (type === "user") {
            const u = users.get(t.targetId);
            if (u) {
                const alias = str(u.alias_name) ?? "unknown";
                view = {
                    summary: `@${alias}`,
                    href: `/profile/${encodeURIComponent(alias)}`,
                    ownerId: t.targetId,
                    state: u.is_suspended ? "Suspended" : null,
                    takeDownLabel: null,
                };
            }
        } else if (type === "message") {
            const m = messages.get(t.targetId);
            if (m) {
                const removable = REMOVABLE_MESSAGE_KINDS.includes(str(m.kind) ?? "chat");
                view = {
                    summary: excerpt(str(m.content)) || "(a photo with no words)",
                    href: null,
                    ownerId: str(m.sender_id),
                    state: m.deleted_at ? "Removed" : removable ? null : "Part of a deal record",
                    takeDownLabel: m.deleted_at || !removable ? null : label,
                };
            }
        } else if (type === "show_entry") {
            const e = entries.get(t.targetId);
            if (e) {
                const horse = str(entryHorses.get(e.horse_id as string)?.custom_name) ?? "A horse";
                const show = shows.get(e.show_id as string);
                const className = str(classes.get(e.class_id as string)?.name);
                const scratched = e.status === "scratched";
                view = {
                    summary: `${horse}${className ? ` in ${className}` : ""}${show ? `, ${str(show.title)}` : ""}`,
                    href: `/shows/${e.show_id}/class/${e.class_id}`,
                    ownerId: str(e.owner_id),
                    state: scratched ? "Scratched" : null,
                    takeDownLabel: scratched ? null : label,
                };
            }
        } else if (type === "id_request") {
            const r = requests.get(t.targetId);
            if (r) {
                view = {
                    summary: excerpt(str(r.description)) || "A Help ID photo with no description",
                    href: `/community/help-id/${t.targetId}`,
                    ownerId: str(r.user_id),
                    state: r.hidden_at ? "Hidden" : null,
                    takeDownLabel: r.hidden_at ? null : label,
                };
            }
        } else if (type === "id_suggestion") {
            const s = suggestions.get(t.targetId);
            if (s) {
                view = {
                    summary: excerpt(str(s.free_text)) || "A suggestion naming a Registry entry",
                    href: `/community/help-id/${s.request_id}#suggestion-${t.targetId}`,
                    ownerId: str(s.user_id),
                    state: s.hidden_at ? "Hidden" : null,
                    takeDownLabel: s.hidden_at ? null : label,
                };
            }
        }
        views.set(key, view ?? GONE);
    }

    const ownerIds = [...new Set([...views.values()].map((v) => v.ownerId).filter((x): x is string => !!x))];
    const owners = await rowsById(db, "users", "id, alias_name", ownerIds);
    const out = new Map<string, ReportTargetView>();
    for (const [key, v] of views) {
        out.set(key, { ...v, ownerAlias: v.ownerId ? (str(owners.get(v.ownerId)?.alias_name) ?? null) : null });
    }
    return out;
}

/** PostgREST / Postgres "no such column": migration 235 isn't pasted yet. */
function isMissingColumn(error: { code?: string } | null): boolean {
    return error?.code === "42703" || error?.code === "PGRST204";
}

/**
 * Take reported content down, the gentle way for its kind. Returns the
 * member who made it, so the caller can tell them. Refuses, in plain words,
 * when this kind can't be taken down from a report card.
 */
export async function takeDownReportedContent(
    db: Db,
    type: ReportTargetType,
    id: string,
    adminId: string,
): Promise<ActionResult<{ ownerId: string | null }>> {
    const now = new Date().toISOString();

    const hideable = HIDEABLE[type];
    if (hideable) {
        const { data, error } = await db
            .from(hideable.table)
            .update({ hidden_at: now, hidden_by: adminId })
            .eq("id", id)
            .select(`id, ${hideable.owner}`);
        if (isMissingColumn(error)) {
            return fail("Hiding needs migration 235. Paste it (Admin › Ops lists it), then try again.");
        }
        if (error) return safeError("Moderation", error, "Could not hide it. Please try again.");
        const row = ((data ?? []) as unknown as Row[])[0];
        if (!row) return fail("It has already been deleted, so there is nothing to hide.");
        return { success: true, ownerId: str(row[hideable.owner]) };
    }

    if (type === "message") {
        const { data: m } = await db
            .from("messages")
            .select("id, kind, sender_id, conversation_id, created_at")
            .eq("id", id)
            .maybeSingle();
        const msg = m as Row | null;
        if (!msg) return fail("That message has already been deleted.");
        if (!REMOVABLE_MESSAGE_KINDS.includes(str(msg.kind) ?? "chat")) {
            return fail(
                "This entry is part of a deal's record and can't be removed. Suspend the member instead if they broke the rules.",
            );
        }
        const { error } = await db.from("messages").update({ deleted_at: now }).eq("id", id);
        if (error) return safeError("Moderation", error, "Could not remove the message. Please try again.");
        await clearInboxPreview(db, str(msg.conversation_id), str(msg.created_at));
        return { success: true, ownerId: str(msg.sender_id) };
    }

    if (type === "horse") {
        const { data: h } = await db
            .from("user_horses")
            .select("id, owner_id, trade_status, deleted_at")
            .eq("id", id)
            .maybeSingle();
        const horse = h as Row | null;
        if (!horse || horse.deleted_at) return fail("That horse has already been deleted by its owner.");
        // Private takes the passport, and with it the listing, off every
        // public surface; the trade status is reset too so the horse does
        // not reappear on the Market if its owner makes it public again.
        const listed = LISTED.includes(str(horse.trade_status) ?? "");
        const { error } = await db
            .from("user_horses")
            .update({ visibility: "private", ...(listed ? { trade_status: "Not for Sale" } : {}) })
            .eq("id", id);
        if (error) return safeError("Moderation", error, "Could not make the horse private. Please try again.");
        return { success: true, ownerId: str(horse.owner_id) };
    }

    if (type === "show_entry") {
        const { data: e } = await db
            .from("show_class_entries")
            .select("id, owner_id, show_id, status")
            .eq("id", id)
            .maybeSingle();
        const entry = e as Row | null;
        if (!entry) return fail("That entry has already been removed from the show.");
        const { data: s } = await db.from("shows").select("status").eq("id", entry.show_id).maybeSingle();
        if (RESULTS_FINAL.includes(str((s as Row | null)?.status) ?? "")) {
            // The same rule the hosts' tools follow: after results, only
            // Strike may change an entry, because it also voids the card
            // and cleans the record.
            return fail(
                "This show's results are published, so scratching would rewrite them. Strike the entry from the results on the show's page instead.",
            );
        }
        const { error } = await db
            .from("show_class_entries")
            .update({ status: "scratched", note: "Scratched by the site team after a report." })
            .eq("id", id);
        if (error) return safeError("Moderation", error, "Could not scratch the entry. Please try again.");
        return { success: true, ownerId: str(entry.owner_id) };
    }

    return fail("Members aren't taken down from a report. Use Suspend in Admin › Members.");
}

/**
 * The inbox list shows each conversation's last line from a stored copy
 * (migration 173). When the removed message is that last line, replace
 * the copy so the words don't live on in the list. Best effort.
 */
async function clearInboxPreview(db: Db, conversationId: string | null, createdAt: string | null): Promise<void> {
    if (!conversationId || !createdAt) return;
    try {
        const { data: c } = await db
            .from("conversations")
            .select("last_message_at")
            .eq("id", conversationId)
            .maybeSingle();
        const last = str((c as Row | null)?.last_message_at);
        if (last && new Date(last).getTime() > new Date(createdAt).getTime()) return;
        await db
            .from("conversations")
            .update({ last_message_preview: "Message removed by a moderator" })
            .eq("id", conversationId);
    } catch {
        /* the preview is cosmetic; the message itself is already removed */
    }
}
