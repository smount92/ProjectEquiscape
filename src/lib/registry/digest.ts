/**
 * The owner's daily Registry digest (owner answers 4 and 5, 2026-10-16).
 *
 * Once moderators are active, the owner stops getting a ping per
 * suggestion; instead, once a day, the bell carries what the Registry
 * Desk did since the last digest: counts by kind, and **every removal and
 * every merge** by name, with who did it, so nothing leaves the Registry
 * unseen. In-app only (the bell), never email.
 *
 * Built inside the existing 06:00 `refresh-market` cron step. "Once a day"
 * is held by the database: the day's registry_digests row is inserted
 * ON CONFLICT DO NOTHING before the bell rings, so a second run that day
 * inserts nothing and sends nothing.
 *
 * Reads 242's registry_actions and 244's registry_style_rules and
 * registry_digests. Before either is pasted it sends nothing and says why.
 */
import "server-only";

import type { getAdminClient } from "@/lib/supabase/admin";
import { createNotificationsBulk } from "@/lib/notifications/createNotification";
import { adminNotificationTargets } from "@/lib/notifications/adminTargets";
import { aliasesFor, deskDb, isMissingSchema } from "@/lib/registry/todo";

type Admin = ReturnType<typeof getAdminClient>;

export interface DigestLine {
    id: string;
    summary: string;
    itemTitle: string | null;
    by: string;
    status: string;
    at: string;
}

export interface RegistryDigest {
    since: string;
    until: string;
    total: number;
    byKind: Record<string, number>;
    /** Every removal since `since`, newest first. */
    removals: DigestLine[];
    /** Every merge since `since` (applied, waiting or declined), newest first. */
    merges: DigestLine[];
    undos: number;
    secondLooksWaiting: number;
    /**
     * Members' suggestions waiting in the Queue. Once a moderator is
     * active the owner no longer gets a ping per suggestion (owner answer
     * 4); this line is where those pings went.
     */
    suggestionsWaiting: number;
    rulesProposed: number;
    rulesInEffect: number;
    /** Moderators whose 12-month term ran out since `since` (their seat stops working then). */
    termsEnded: { alias: string; endedAt: string }[];
}

interface ActionRow {
    id: string;
    kind: string;
    status: string;
    actor_id: string | null;
    item_title: string | null;
    summary: string;
    created_at: string;
}

/** What the Registry Desk did since `since`. Throws a missing-schema error before 242. */
export async function buildRegistryDigest(admin: Admin, since: string): Promise<RegistryDigest> {
    const db = deskDb(admin);
    const until = new Date().toISOString();
    const actions: ActionRow[] = [];
    for (let from = 0; ; from += 1000) {
        const { data, error } = await db
            .from("registry_actions")
            .select("id, kind, status, actor_id, item_title, summary, created_at")
            .gte("created_at", since)
            .order("created_at", { ascending: false })
            .range(from, from + 999);
        if (error) throw error;
        actions.push(...((data ?? []) as ActionRow[]));
        if ((data ?? []).length < 1000) break;
    }
    const { count: waiting } = await db
        .from("registry_actions")
        .select("id", { count: "exact", head: true })
        .eq("status", "awaiting_second_look");
    const { count: suggestionsWaiting } = await db
        .from("catalog_suggestions")
        .select("id", { count: "exact", head: true })
        .in("status", ["pending", "under_review"]);

    let rulesProposed = 0;
    let rulesInEffect = 0;
    const { data: rules, error: rulesError } = await db
        .from("registry_style_rules")
        .select("status, created_at, in_effect_at")
        .or(`created_at.gte."${since}",in_effect_at.gte."${since}"`);
    if (!rulesError) {
        for (const r of (rules ?? []) as { status: string; created_at: string; in_effect_at: string | null }[]) {
            if (r.created_at >= since) rulesProposed++;
            if (r.in_effect_at && r.in_effect_at >= since) rulesInEffect++;
        }
    }

    // Terms that ran out inside the window (term_ends_at, 242). A read
    // that fails leaves the line out; it never stops the digest.
    const { data: ended, error: endedError } = await db
        .from("registry_moderators")
        .select("user_id, term_ends_at")
        // A seat already removed or stepped down ended then, not now.
        .in("status", ["active", "resting"])
        .gte("term_ends_at", since)
        .lte("term_ends_at", until)
        .order("term_ends_at", { ascending: false });
    const endedRows = endedError ? [] : ((ended ?? []) as { user_id: string; term_ends_at: string }[]);

    const aliases = await aliasesFor(admin, [...actions.map((a) => a.actor_id), ...endedRows.map((r) => r.user_id)]);
    const line = (a: ActionRow): DigestLine => ({
        id: a.id,
        summary: a.summary,
        itemTitle: a.item_title,
        by: a.actor_id ? (aliases.get(a.actor_id) ?? "a moderator") : "the site",
        status: a.status,
        at: a.created_at,
    });
    const byKind: Record<string, number> = {};
    for (const a of actions) byKind[a.kind] = (byKind[a.kind] ?? 0) + 1;

    return {
        since,
        until,
        total: actions.length,
        byKind,
        removals: actions.filter((a) => a.kind === "remove").map(line),
        merges: actions.filter((a) => a.kind === "merge").map(line),
        undos: byKind.undo ?? 0,
        secondLooksWaiting: waiting ?? 0,
        suggestionsWaiting: suggestionsWaiting ?? 0,
        rulesProposed,
        rulesInEffect,
        termsEnded: endedRows.map((r) => ({
            alias: aliases.get(r.user_id) ?? "a moderator",
            endedAt: r.term_ends_at,
        })),
    };
}

const ON_DAY = new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric", timeZone: "UTC" });

const KIND_WORDS: Record<string, [string, string]> = {
    edit: ["edit", "edits"],
    add: ["new entry", "new entries"],
    refile: ["re-filing", "re-filings"],
    approve: ["approval", "approvals"],
    reject: ["rejection", "rejections"],
    revert: ["revert", "reverts"],
    merge: ["merge", "merges"],
    remove: ["removal", "removals"],
    undo: ["undo", "undos"],
};
const plural = (n: number, kind: string) => {
    const [one, many] = KIND_WORDS[kind] ?? [kind, kind];
    return `${n} ${n === 1 ? one : many}`;
};
const STATUS_WORDS: Record<string, string> = {
    awaiting_second_look: "waiting for a second look",
    declined: "declined",
    undone: "since undone",
    failed: "failed",
    pending: "did not finish",
};

/** The digest in the owner's bell: counts first, then every removal and every merge by name. */
export function digestText(d: RegistryDigest): string {
    const counts = Object.keys(KIND_WORDS)
        .filter((k) => d.byKind[k])
        .map((k) => plural(d.byKind[k], k));
    const parts = [`Registry Desk, last 24 hours: ${counts.length ? counts.join(", ") : "no changes"}.`];
    const say = (l: DigestLine) =>
        `${l.summary} (@${l.by}${STATUS_WORDS[l.status] ? `, ${STATUS_WORDS[l.status]}` : ""})`;
    if (d.removals.length) parts.push(`Removed: ${d.removals.map(say).join("; ")}.`);
    if (d.merges.length) parts.push(`Merged: ${d.merges.map(say).join("; ")}.`);
    if (d.secondLooksWaiting) parts.push(`${d.secondLooksWaiting} waiting for a second look.`);
    if (d.suggestionsWaiting)
        parts.push(
            `${d.suggestionsWaiting} member suggestion${d.suggestionsWaiting === 1 ? "" : "s"} waiting in the Queue.`,
        );
    if (d.rulesProposed || d.rulesInEffect)
        parts.push(
            `Style rules: ${d.rulesProposed} proposed, ${d.rulesInEffect} took effect. You can veto any of them on the Rules tab.`,
        );
    for (const t of d.termsEnded ?? [])
        parts.push(`@${t.alias}'s moderator term ended on ${ON_DAY.format(new Date(t.endedAt))}.`);
    return parts.join(" ");
}

export type DigestOutcome =
    | { sent: true; day: string; recipients: number; total: number }
    | { sent: false; reason: "pending_242" | "pending_244" | "already_sent" | "quiet"; day: string };

/** UTC calendar day, the digest's key. */
export function digestDay(now: Date = new Date()): string {
    return now.toISOString().slice(0, 10);
}

/**
 * Build and send today's digest, once. Records the day first (insert ON
 * CONFLICT DO NOTHING); only the run that inserted it rings the bell. A
 * day with nothing to report is recorded but rings nothing.
 */
export async function sendRegistryDigest(admin: Admin, now: Date = new Date()): Promise<DigestOutcome> {
    const db = deskDb(admin);
    const day = digestDay(now);

    const { data: last, error: lastError } = await db
        .from("registry_digests")
        .select("day, sent_at")
        .order("day", { ascending: false })
        .limit(1);
    if (lastError) {
        if (isMissingSchema(lastError)) return { sent: false, reason: "pending_244", day };
        throw lastError;
    }
    const previous = ((last ?? []) as { day: string; sent_at: string }[])[0];
    if (previous?.day === day) return { sent: false, reason: "already_sent", day };
    const since = previous?.sent_at ?? new Date(now.getTime() - 24 * 3600 * 1000).toISOString();

    let digest: RegistryDigest;
    try {
        digest = await buildRegistryDigest(admin, since);
    } catch (err) {
        if (isMissingSchema(err)) return { sent: false, reason: "pending_242", day };
        throw err;
    }

    const { data: inserted, error: insertError } = await db
        .from("registry_digests")
        .upsert({ day, summary: digest }, { onConflict: "day", ignoreDuplicates: true })
        .select("day");
    if (insertError) throw insertError;
    if (!inserted || (inserted as unknown[]).length === 0) return { sent: false, reason: "already_sent", day };

    const quiet =
        digest.total === 0 &&
        !digest.rulesProposed &&
        !digest.rulesInEffect &&
        !digest.secondLooksWaiting &&
        !digest.suggestionsWaiting &&
        digest.termsEnded.length === 0;
    if (quiet) return { sent: false, reason: "quiet", day };

    const owners = await adminNotificationTargets(admin);
    const content = digestText(digest);
    const recipients = await createNotificationsBulk(
        owners.map((userId) => ({
            userId,
            type: "registry_digest",
            content,
            linkUrl: "/catalog/desk/history",
        })),
    );
    return { sent: true, day, recipients, total: digest.total };
}
