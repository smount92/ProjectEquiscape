import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { fail, safeError, type ActionFailure, type ActionResult } from "@/lib/actions/result";
import { logger } from "@/lib/logger";
import {
    NOTICE_EXCERPT,
    REPORT_TAKE_DOWN_LABEL,
    type ReportTargetType,
    type ReportTargetView,
} from "@/lib/moderation/reports";

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
 * private or scratch, so every one can be undone from the database. (The
 * notifications that pointed at a hidden thread are deleted: they are our
 * words, not the member's, and they would keep its title in view.)
 */

/** Untyped on purpose: the migration 235 columns postdate the generated types. */
type Db = SupabaseClient;

export const targetKey = (type: string, id: string) => `${type}:${id}`;

const EXCERPT = 160;

export function excerpt(text: string | null | undefined, max = EXCERPT): string {
    const flat = (text ?? "").replace(/\s+/g, " ").trim();
    return flat.length > max ? `${flat.slice(0, max - 1)}…` : flat;
}

/** A notice's name for some words: the start of them, or null when there are none. */
const noticeExcerpt = (text: string | null | undefined) => excerpt(text, NOTICE_EXCERPT) || null;

const GONE: ReportTargetView = {
    summary: "This has since been deleted.",
    name: null,
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

/** An offer nobody has accepted yet: the take-down withdraws it. */
const OPEN_OFFER = "offer_made";
/** A sale past the offer: the take-down waits until it is resolved in the Deal Room. */
const SALE_UNDER_WAY = ["pending_payment", "funds_verified"];

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

    // Horses and entries are read whole (*) so the 235 stamps come back
    // when they exist and nothing fails before the migration is pasted.
    const [posts, horses, users, messages, entries, requests, suggestions] = await Promise.all([
        rowsById(db, "posts", "*", idsOf("post", "comment")),
        rowsById(db, "user_horses", "*", idsOf("horse")),
        rowsById(db, "users", "id, alias_name, is_suspended", idsOf("user")),
        rowsById(db, "messages", "*", idsOf("message")),
        rowsById(db, "show_class_entries", "*", idsOf("show_entry")),
        rowsById(db, "id_requests", "*", idsOf("id_request")),
        rowsById(db, "id_suggestions", "*", idsOf("id_suggestion")),
    ]);

    // A barn reply has no group_id of its own (replyToThread calls
    // add_post_reply without one); its thread has, so read the threads too.
    const parents = await rowsById(db, "posts", "id, group_id", [
        ...new Set(
            [...posts.values()]
                .filter((p) => str(p.parent_id) && !str(p.group_id))
                .map((p) => str(p.parent_id) as string),
        ),
    ]);
    const groupOf = (p: Row) => str(p.group_id) ?? str(parents.get(str(p.parent_id) ?? "")?.group_id);

    // Second hop: barn slugs for thread links, and the names a show entry needs.
    const groupIds = [...posts.values()].map(groupOf).filter((x): x is string => !!x);
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
                const slug = str(groups.get(groupOf(p) ?? "")?.slug);
                const title = str(p.title);
                view = {
                    summary: title ? `${title}: ${excerpt(str(p.content), 120)}` : excerpt(str(p.content)),
                    name: title ? excerpt(title, NOTICE_EXCERPT) : noticeExcerpt(str(p.content)),
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
                const held = !!h.moderation_hidden_at;
                // A horse its owner made private can be made public again
                // by its owner, so it can still be taken down (stamped) —
                // once 235 is in and there is a stamp to set.
                const canStamp = "moderation_hidden_at" in h;
                view = {
                    summary: `${str(h.custom_name) ?? "Unnamed horse"}${listed ? " (listed for sale)" : ""}`,
                    name: str(h.custom_name),
                    href: `/community/${t.targetId}`,
                    ownerId: str(h.owner_id),
                    state: h.deleted_at
                        ? "Deleted by its owner"
                        : held
                          ? "Made private by the site team"
                          : isPrivate
                            ? "Private"
                            : null,
                    takeDownLabel:
                        h.deleted_at || held || (isPrivate && !canStamp)
                            ? null
                            : isPrivate
                              ? "Keep the horse private"
                              : label,
                };
            }
        } else if (type === "user") {
            const u = users.get(t.targetId);
            if (u) {
                const alias = str(u.alias_name) ?? "unknown";
                view = {
                    summary: `@${alias}`,
                    name: `@${alias}`,
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
                    name: noticeExcerpt(str(m.content)),
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
                const held = !!e.moderation_scratched_at;
                // An entry its owner scratched can be entered again, so it
                // can still be stamped (235) to keep the horse out of the class.
                const canStamp = "moderation_scratched_at" in e;
                view = {
                    summary: `${horse}${className ? ` in ${className}` : ""}${show ? `, ${str(show.title)}` : ""}`,
                    name: `${horse}${className ? ` in ${className}` : ""}`,
                    href: `/shows/${e.show_id}/class/${e.class_id}`,
                    ownerId: str(e.owner_id),
                    state: held ? "Scratched by the site team" : scratched ? "Scratched" : null,
                    takeDownLabel:
                        held || (scratched && !canStamp) ? null : scratched ? "Keep it out of this class" : label,
                };
            }
        } else if (type === "id_request") {
            const r = requests.get(t.targetId);
            if (r) {
                view = {
                    summary: excerpt(str(r.description)) || "A Help ID photo with no description",
                    name: noticeExcerpt(str(r.description)),
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
                    name: noticeExcerpt(str(s.free_text)),
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

/** An open offer the take-down withdrew, so its buyer can be told. */
export interface WithdrawnOffer {
    buyerId: string;
    conversationId: string | null;
}

export interface TakeDownResult {
    /** The member who made it, so the caller can tell them. */
    ownerId: string | null;
    /** Horses only: the open offers on it that were withdrawn. */
    withdrawnOffers: WithdrawnOffer[];
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
): Promise<ActionResult<TakeDownResult>> {
    const now = new Date().toISOString();
    const done = (ownerId: string | null, withdrawnOffers: WithdrawnOffer[] = []) =>
        ({ success: true, ownerId, withdrawnOffers }) as const;

    const hideable = HIDEABLE[type];
    if (hideable) {
        const isPost = hideable.table === "posts";
        // Only while it is still showing, so a second take-down (another
        // report on the same thing) keeps the first stamp and tells nobody twice.
        const { data, error } = await db
            .from(hideable.table)
            .update({ hidden_at: now, hidden_by: adminId })
            .eq("id", id)
            .is("hidden_at", null)
            .select(isPost ? "id, author_id, parent_id, group_id, created_at" : `id, ${hideable.owner}`);
        if (isMissingColumn(error)) {
            return fail("Hiding needs migration 235. Paste it (Admin › Ops lists it), then try again.");
        }
        if (error) return safeError("Moderation", error, "Could not hide it. Please try again.");
        const row = ((data ?? []) as unknown as Row[])[0];
        if (!row) {
            const { data: still } = await db.from(hideable.table).select("id").eq("id", id).maybeSingle();
            // Already hidden: the report is closed as dealt with, and nobody is told again.
            if (still) return done(null);
            return fail("It has already been deleted, so there is nothing to hide.");
        }
        if (isPost) await clearNotificationsAbout(db, row);
        return done(str(row[hideable.owner]));
    }

    if (type === "message") {
        const { data: m } = await db
            .from("messages")
            .select("id, kind, sender_id, conversation_id, created_at, deleted_at")
            .eq("id", id)
            .maybeSingle();
        const msg = m as Row | null;
        if (!msg) return fail("That message has already been deleted.");
        if (msg.deleted_at) return done(null); // already removed: nobody is told again
        if (!REMOVABLE_MESSAGE_KINDS.includes(str(msg.kind) ?? "chat")) {
            return fail(
                "This entry is part of a deal's record and can't be removed. Suspend the member instead if they broke the rules.",
            );
        }
        const { error } = await db.from("messages").update({ deleted_at: now }).eq("id", id).is("deleted_at", null);
        if (error) return safeError("Moderation", error, "Could not remove the message. Please try again.");
        await clearInboxPreview(db, str(msg.conversation_id), str(msg.created_at));
        return done(str(msg.sender_id));
    }

    if (type === "horse") return takeDownHorse(db, id, adminId, now);

    if (type === "show_entry") {
        const { data: e } = await db.from("show_class_entries").select("*").eq("id", id).maybeSingle();
        const entry = e as Row | null;
        if (!entry) return fail("That entry has already been removed from the show.");
        if (entry.moderation_scratched_at) return done(null); // already scratched by us: nobody is told again
        const { data: s } = await db.from("shows").select("status").eq("id", entry.show_id).maybeSingle();
        if (RESULTS_FINAL.includes(str((s as Row | null)?.status) ?? "")) {
            // The same rule the hosts' tools follow: after results, only
            // Strike may change an entry, because it also voids the card
            // and cleans the record.
            return fail(
                "This show's results are published, so scratching would rewrite them. Strike the entry from the results on the show's page instead.",
            );
        }
        // The stamp (235) stops the same horse being entered in the same
        // class again. Before 235 the scratch still happens, without it.
        // An entry its owner already scratched keeps its own note and just
        // gains the stamp, so it can't simply be entered again.
        const alreadyScratched = entry.status === "scratched";
        const scratch = alreadyScratched
            ? {}
            : { status: "scratched", note: "Scratched by the site team after a report." };
        let { error } = await db
            .from("show_class_entries")
            .update({ ...scratch, moderation_scratched_at: now })
            .eq("id", id);
        if (isMissingColumn(error)) {
            if (alreadyScratched) return fail("This entry is already scratched.");
            ({ error } = await db.from("show_class_entries").update(scratch).eq("id", id));
        }
        if (error) return safeError("Moderation", error, "Could not scratch the entry. Please try again.");
        return done(str(entry.owner_id));
    }

    return fail("Members aren't taken down from a report. Use Suspend in Admin › Members.");
}

/**
 * Make a reported horse private and end its listing, stamped so its owner
 * can't simply make it public again (235).
 *
 * A sale already under way is not undone from a report card: the money and
 * the handover are between two members, so the admin resolves it in the
 * Deal Room first. Open offers are withdrawn (an accepted offer on a
 * hidden horse would start a sale nobody can see), and their buyers are
 * returned so the caller can tell them.
 */
async function takeDownHorse(db: Db, id: string, adminId: string, now: string): Promise<ActionResult<TakeDownResult>> {
    const { data: h } = await db.from("user_horses").select("*").eq("id", id).maybeSingle();
    const horse = h as Row | null;
    if (!horse || horse.deleted_at) return fail("That horse has already been deleted by its owner.");
    if (horse.moderation_hidden_at) return { success: true, ownerId: null, withdrawnOffers: [] }; // already held: nobody is told again

    const saleUnderWay = async (): Promise<ActionFailure | null> => {
        const { data: deals, error } = await db
            .from("transactions")
            .select("id, status, conversation_id")
            .eq("horse_id", id)
            .in("status", SALE_UNDER_WAY);
        if (error) return safeError("Moderation", error, "Could not check the horse's sales. Please try again.");
        const underWay = ((deals ?? []) as Row[])[0];
        if (!underWay) return null;
        const conversationId = str(underWay.conversation_id);
        return fail(
            `This horse is in a sale that's under way. Resolve it in the Deal Room first${
                conversationId ? ` (/inbox/${conversationId})` : ""
            }, then take the horse down.`,
        );
    };
    const before = await saleUnderWay();
    if (before) return before;

    // Withdraw open offers before the horse goes private. The condition on
    // status leaves alone an offer accepted a moment ago; the second check
    // below then catches it.
    const { data: withdrawn, error: offersError } = await db
        .from("transactions")
        .update({ status: "cancelled" })
        .eq("horse_id", id)
        .eq("status", OPEN_OFFER)
        .select("id, party_b_id, conversation_id");
    if (offersError)
        return safeError("Moderation", offersError, "Could not withdraw the open offers. Please try again.");
    const withdrawnRows = (withdrawn ?? []) as Row[];
    const withdrawnOffers = withdrawnRows
        .filter((t) => !!str(t.party_b_id))
        .map((t) => ({ buyerId: str(t.party_b_id) as string, conversationId: str(t.conversation_id) }));
    const after = await saleUnderWay();
    if (after) {
        // A sale started in between: leave everything as it was, offers too.
        if (withdrawnRows.length > 0) {
            const { error: restoreError } = await db
                .from("transactions")
                .update({ status: OPEN_OFFER })
                .in(
                    "id",
                    withdrawnRows.map((t) => t.id as string),
                )
                .eq("status", "cancelled");
            if (restoreError) logger.error("Moderation", "Could not put withdrawn offers back", restoreError);
        }
        return after;
    }

    // Private takes the passport, and with it the listing, off every
    // public surface; the trade status is reset too so the horse does
    // not reappear on the Market if the hold is ever lifted.
    // A "Pending Sale" with no sale under way (checked above) is stale, and
    // a later reset to "Open to Offers" would trip the hold, so it goes too.
    const listed = [...LISTED, "Pending Sale"].includes(str(horse.trade_status) ?? "");
    const privately = { visibility: "private", ...(listed ? { trade_status: "Not for Sale" } : {}) };
    let { error } = await db
        .from("user_horses")
        .update({ ...privately, moderation_hidden_at: now, moderation_hidden_by: adminId })
        .eq("id", id);
    if (isMissingColumn(error)) {
        // Before 235: private without the stamp, as before.
        ({ error } = await db.from("user_horses").update(privately).eq("id", id));
    }
    if (error) return safeError("Moderation", error, "Could not make the horse private. Please try again.");
    return { success: true, ownerId: str(horse.owner_id), withdrawnOffers };
}

/**
 * The bell keeps a hidden thread's title ("New thread in …", "replied in
 * …") in every member's list, and links to a page that is gone. Delete the
 * notifications that point at what was hidden. Best effort: the content is
 * already hidden.
 *
 * A thread or feed post: every notification linking to it. A reply: the
 * ones its author's reply sent (the same link, from that author, in the
 * minutes after it was posted), so other members' replies keep theirs.
 */
async function clearNotificationsAbout(db: Db, post: Row): Promise<void> {
    const id = str(post.id);
    const parentId = str(post.parent_id);
    try {
        if (!id) return;
        // A barn reply has no group_id of its own; its thread says whether
        // the notices link to a barn thread or a feed post.
        let inBarn = !!str(post.group_id);
        if (!inBarn && parentId) {
            const { data: parent } = await db.from("posts").select("group_id").eq("id", parentId).maybeSingle();
            inBarn = !!str((parent as Row | null)?.group_id);
        }
        const linkOf = (postId: string) => (inBarn ? `%/thread/${postId}` : `/feed/${postId}`);
        if (!parentId) {
            const q = db.from("notifications").delete();
            const { error } = inBarn ? await q.like("link_url", linkOf(id)) : await q.eq("link_url", linkOf(id));
            if (error) throw error;
            return;
        }
        const author = str(post.author_id);
        const postedAt = str(post.created_at);
        if (!author || !postedAt) return;
        const until = new Date(new Date(postedAt).getTime() + REPLY_NOTICE_WINDOW_MS).toISOString();
        const q = db.from("notifications").delete();
        const scoped = inBarn ? q.like("link_url", linkOf(parentId)) : q.eq("link_url", linkOf(parentId));
        const { error } = await scoped.eq("actor_id", author).gte("created_at", postedAt).lte("created_at", until);
        if (error) throw error;
    } catch (err) {
        logger.error("Moderation", "Clearing notifications about hidden content failed (it stays hidden)", err);
    }
}

/** How long after a reply its notices are sent (they go out in after()). */
const REPLY_NOTICE_WINDOW_MS = 5 * 60_000;

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
