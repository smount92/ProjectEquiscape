import { NextRequest, NextResponse } from "next/server";
import { getAdminClient } from "@/lib/supabase/admin";
import * as Sentry from "@sentry/nextjs";

import { canTransition } from "@/lib/shows/stateMachine";
import {
    buildDeadlinePlans,
    isClosingWithin24h,
} from "@/lib/shows/notifications";
import { createNotificationsBulk } from "@/lib/notifications/createNotification";
import { sendEntriesClosingEmails } from "@/lib/email/showEmails";
import type { ShowMode, ShowStatus } from "@/lib/shows/types";

/**
 * Cron endpoint — the shows clock. Hourly (vercel.json). Does:
 *   1. LEGACY events: expired "open" photo/live shows → "judging".
 *   2. V2 auto-open: published shows whose entries_open_at has
 *      passed → entries_open.
 *   3. V2 auto-close: entries_open shows whose entries_close_at has
 *      passed → entries_closed.
 *   4. V2 deadline nudges: entries_open shows closing within 24h →
 *      notify + email each live entrant once (deduped on an existing
 *      show_deadline notification for that user+show).
 *
 * Schedule: 0 * * * * (hourly)
 * Auth: Bearer CRON_SECRET header
 *
 * ADMIN CLIENT — required: crons have no session, so every RLS-gated
 * read returns nothing on the plain client. The v2 flips still run
 * through canTransition (the state machine stays the single
 * authority) and use CAS updates so a racing host action wins.
 */
export async function GET(request: NextRequest) {
    const authHeader = request.headers.get("authorization");
    // Unset-secret guard: without it, an env missing CRON_SECRET
    // (e.g. preview deploys) accepts the literal "Bearer undefined".
    if (!process.env.CRON_SECRET || authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    try {
        const admin = getAdminClient();
        const now = new Date();
        const nowIso = now.toISOString();

        // ── 1. Legacy events: expired "open" shows → "judging" ──
        const { data: expiredShows, error } = await admin
            .from("events")
            .select("id, name")
            .eq("show_status", "open")
            .lt("ends_at", nowIso)
            .in("event_type", ["photo_show", "live_show"]);

        if (error) throw error;

        let legacyTransitioned = 0;
        for (const show of (expiredShows ?? [])) {
            // CAS guard: only update if still "open"
            const { error: updateError } = await admin
                .from("events")
                .update({ show_status: "judging" })
                .eq("id", show.id)
                .eq("show_status", "open");

            if (!updateError) legacyTransitioned++;
        }

        // ── 2+3. V2 lifecycle flips, via the state machine ──
        const flipV2 = async (
            from: ShowStatus,
            to: ShowStatus,
            deadlineColumn: "entries_open_at" | "entries_close_at",
        ): Promise<number> => {
            const { data: dueRows, error: dueError } = await admin
                .from("shows")
                .select("id, mode, status")
                .eq("status", from)
                .not(deadlineColumn, "is", null)
                .lte(deadlineColumn, nowIso);
            if (dueError) throw dueError;

            let flipped = 0;
            for (const show of dueRows ?? []) {
                const legal = canTransition(from, to, show.mode as ShowMode);
                if (!legal.ok) continue; // never bypass the machine
                const { error: flipError } = await admin
                    .from("shows")
                    .update({ status: to })
                    .eq("id", show.id)
                    .eq("status", from); // CAS: a racing host action wins
                if (!flipError) flipped++;
            }
            return flipped;
        };

        const opened = await flipV2("published", "entries_open", "entries_open_at");
        const closed = await flipV2("entries_open", "entries_closed", "entries_close_at");

        // ── 3b. Judging deadline: nudge the host, never force-flip ──
        // (Audit S11: judging_ends_at had no enforcer — shows sat in
        // judging forever. A forced flip would break community-vote
        // shows, whose placings only exist after the host finalizes
        // the tally — so the clock nudges the HOST, once, dedup'd on
        // the '#judging-overdue' link.)
        let judgingNudged = 0;
        const { data: overdueRows, error: overdueError } = await admin
            .from("shows")
            .select("id, title, host_id")
            .eq("status", "judging")
            .not("judging_ends_at", "is", null)
            .lte("judging_ends_at", nowIso);
        if (overdueError) throw overdueError;
        for (const show of overdueRows ?? []) {
            const overdueLink = `/shows/host/${show.id}#judging-overdue`;
            const { data: sent } = await admin
                .from("notifications")
                .select("id")
                .eq("type", "show_deadline")
                .eq("user_id", show.host_id as string)
                .eq("link_url", overdueLink)
                .limit(1);
            if (sent && sent.length > 0) continue;
            await createNotificationsBulk([
                {
                    userId: show.host_id as string,
                    type: "show_deadline",
                    actorId: null,
                    content: `Judging for "${show.title}" has passed its deadline — finalize the results when ready.`,
                    linkUrl: overdueLink,
                },
            ]);
            judgingNudged++;
        }

        // ── 4. Deadline nudges: entries_open, closing within 24h ──
        // (Runs AFTER the flips so a just-closed show never nudges.)
        const { data: closingRows, error: closingError } = await admin
            .from("shows")
            .select("id, title, entries_close_at")
            .eq("status", "entries_open")
            .not("entries_close_at", "is", null)
            .lte("entries_close_at", new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString());
        if (closingError) throw closingError;

        let reminded = 0;
        for (const show of closingRows ?? []) {
            const showId = show.id as string;
            const entriesCloseAt = (show.entries_close_at as string | null) ?? null;
            if (!isClosingWithin24h(entriesCloseAt, now)) continue;

            const { data: entryRows, error: entriesError } = await admin
                .from("show_class_entries")
                .select("owner_id, status")
                .eq("show_id", showId);
            if (entriesError) throw entriesError;
            const owners = [
                ...new Set(
                    (entryRows ?? [])
                        .filter((e) => e.status !== "scratched")
                        .map((e) => e.owner_id as string),
                ),
            ];
            if (owners.length === 0) continue;

            // Dedupe: one nudge per user per show, keyed on an existing
            // show_deadline notification deep-linking this show. PREFIX
            // match, not equality: buildDeadlinePlans writes
            // `/shows/{id}#entries` — the old `.eq` on the bare URL never
            // matched, so every hourly run re-nudged every entrant
            // (audit S4: ~720 duplicate emails per 24h deadline window).
            const { data: sentRows, error: sentError } = await admin
                .from("notifications")
                .select("user_id")
                .eq("type", "show_deadline")
                .like("link_url", `/shows/${showId}%`)
                .in("user_id", owners);
            if (sentError) throw sentError;
            const alreadyNudged = new Set((sentRows ?? []).map((r) => r.user_id as string));
            const toNudge = owners.filter((ownerId) => !alreadyNudged.has(ownerId));
            if (toNudge.length === 0) continue;

            await createNotificationsBulk(
                buildDeadlinePlans({
                    showId,
                    showTitle: show.title as string,
                    recipientIds: toNudge,
                }),
            );
            await sendEntriesClosingEmails({
                showId,
                showTitle: show.title as string,
                entriesCloseAt,
                recipientIds: toNudge,
            });
            reminded += toNudge.length;
        }

        return NextResponse.json({
            success: true,
            legacy_transitioned: legacyTransitioned,
            legacy_checked: expiredShows?.length ?? 0,
            v2_opened: opened,
            v2_closed: closed,
            v2_deadline_nudges: reminded,
            v2_judging_overdue_nudges: judgingNudged,
            checkedAt: nowIso,
        });
    } catch (error) {
        Sentry.captureException(error, { tags: { domain: "cron" }, level: "error" });
        return NextResponse.json({ success: false, error: String(error) }, { status: 500 });
    }
}
