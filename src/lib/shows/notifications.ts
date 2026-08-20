/**
 * Shows domain — the v2 NOTIFICATION SPINE.
 *
 * Two layers, same shape as cardIssuance.ts:
 *   1. Pure "plan" builders — decide WHO gets WHAT text for each
 *      show event (results published, cards minted, staff added,
 *      class split/combined, voting opened, staff scratch, host
 *      announcement, deadline nudge). No I/O; fully unit-tested.
 *   2. run*Fanout orchestrators — load the context rows, build the
 *      plans, and hand them to createNotification(-sBulk). Called
 *      from `after()` blocks in the shows-v2 actions and from the
 *      transition-shows cron; every orchestrator swallows its own
 *      errors (a broken ping must never break a publish).
 *
 * Actor semantics: fan-outs are SYSTEM events (actorId null) — the
 * self-guard in createNotification only fires when an actor is
 * present, so hosts see their own show's results too. Targeted
 * pokes caused by one person (staff added, staff scratch, host
 * announcement) carry that person as actor.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { logger } from "@/lib/logger";
import {
    createNotification,
    createNotificationsBulk,
    type NotificationInput,
} from "@/lib/notifications/createNotification";
import { sendShowResultsEmails } from "@/lib/email/showEmails";
import { placeLabel } from "./placings";
import { getAliases, getHorseNames, loadClassContexts } from "./queries";
import type { PlannedCard } from "./cardIssuance";
import type { Place, StaffRole } from "./types";

// ══════════════════════════════════════════════════════════════
// Pure plan builders
// ══════════════════════════════════════════════════════════════

/** How many placements a results notification spells out before "and N more". */
export const MAX_LISTED_PLACEMENTS = 3;

export interface PlacementLine {
    horseId: string;
    horseName: string;
    /** 1..6 */
    place: number;
    className: string;
}

/** One entrant's published results — the shared shape notifications AND emails render from. */
export interface EntrantResults {
    ownerId: string;
    /** Best place first; empty = entered but unplaced. */
    placements: PlacementLine[];
}

const formatRole = (role: StaffRole): string =>
    role === "co_host" ? "co-host" : role;

/**
 * Fold entries + placings into per-owner results. EVERY distinct
 * live-entry owner appears (placed and unplaced — the unplaced
 * majority still deserves "results are up"); scratched entries are
 * history and never notify.
 */
export function buildEntrantResults(input: {
    entries: { id: string; ownerId: string; horseId: string; classId: string; status: string }[];
    placings: { entryId: string; place: number | null }[];
    classNamesById: Map<string, string>;
    horseNamesById: Map<string, string>;
}): EntrantResults[] {
    const live = input.entries.filter((e) => e.status !== "scratched");
    const entryById = new Map(live.map((e) => [e.id, e]));

    const placementsByOwner = new Map<string, PlacementLine[]>();
    for (const placing of input.placings) {
        if (placing.place === null) continue;
        const entry = entryById.get(placing.entryId);
        if (!entry) continue; // scratched or foreign row — never notify
        const list = placementsByOwner.get(entry.ownerId) ?? [];
        list.push({
            horseId: entry.horseId,
            horseName: input.horseNamesById.get(entry.horseId) ?? "Your horse",
            place: placing.place,
            className: input.classNamesById.get(entry.classId) ?? "a class",
        });
        placementsByOwner.set(entry.ownerId, list);
    }

    // Distinct owners in first-entry order → stable output.
    const owners: string[] = [];
    const seen = new Set<string>();
    for (const e of live) {
        if (seen.has(e.ownerId)) continue;
        seen.add(e.ownerId);
        owners.push(e.ownerId);
    }

    return owners.map((ownerId) => ({
        ownerId,
        placements: (placementsByOwner.get(ownerId) ?? []).sort(
            (a, b) => a.place - b.place,
        ),
    }));
}

/**
 * Results published → one summary notification per entrant.
 * Placed: "🏆 {horse} placed {n} in {class} at {show}" listing up to
 * MAX_LISTED_PLACEMENTS placements + "and N more". Unplaced:
 * "Results are up for {show}".
 */
export function buildResultsNotificationPlans(input: {
    showId: string;
    showTitle: string;
    results: EntrantResults[];
}): NotificationInput[] {
    return input.results.map((r) => {
        let content: string;
        if (r.placements.length === 0) {
            content = `📋 Results are up for ${input.showTitle} — see how your entries did.`;
        } else {
            const listed = r.placements
                .slice(0, MAX_LISTED_PLACEMENTS)
                .map((p) => `${p.horseName} placed ${placeLabel(p.place as Place)} in ${p.className}`)
                .join(", ");
            const extra = r.placements.length - MAX_LISTED_PLACEMENTS;
            content = `🏆 ${listed}${extra > 0 ? `, and ${extra} more` : ""} at ${input.showTitle}`;
        }
        return {
            userId: r.ownerId,
            type: "show_result",
            actorId: null,
            content,
            // #results — straight to the champions/results region.
            linkUrl: `/shows/${input.showId}#results`,
        };
    });
}

/**
 * Qualification cards minted → one notification per owner, grouping
 * that owner's cards. The copy carries the CARD — its field, its
 * STAKES flag, its code — and a single card links straight to its
 * verify page (the artifact worth sharing); multiples land on the
 * stable. Season-felt wave: a card notice that just said "earned a
 * card" hid everything that makes the card worth earning.
 */
export function buildCardNotificationPlans(input: {
    cards: {
        horseId: string;
        ownerId: string;
        earnedPlace?: 1 | 2;
        classEntryCount?: number;
        classExhibitorCount?: number;
        isStakes?: boolean;
        code?: string;
    }[];
    horseNamesById: Map<string, string>;
}): NotificationInput[] {
    const byOwner = new Map<string, (typeof input.cards)[number][]>();
    for (const card of input.cards) {
        const list = byOwner.get(card.ownerId) ?? [];
        list.push(card);
        byOwner.set(card.ownerId, list);
    }

    const fieldLine = (c: (typeof input.cards)[number]): string => {
        if (!c.classEntryCount || !c.classExhibitorCount) return "";
        return ` — ${c.earnedPlace === 2 ? "2nd" : "1st"} of ${c.classEntryCount} (${c.classExhibitorCount} exhibitors)`;
    };

    return [...byOwner.entries()].map(([ownerId, cards]) => {
        const names = [
            ...new Set(cards.map((c) => input.horseNamesById.get(c.horseId) ?? "Your horse")),
        ];
        const listed = names.slice(0, MAX_LISTED_PLACEMENTS).join(", ");
        const extra = names.length - MAX_LISTED_PLACEMENTS;
        const single = cards.length === 1 ? cards[0] : null;
        const stakesCount = cards.filter((c) => c.isStakes).length;
        const content = single
            ? `🎖️ ${names[0]} earned a${single.isStakes ? " STAKES" : "n MHH"} Qualification Card${fieldLine(single)}${single.code ? ` · Card ${single.code}` : ""}`
            : `🎖️ ${listed}${extra > 0 ? ` and ${extra} more` : ""} earned ${cards.length} MHH Qualification Cards${stakesCount > 0 ? ` (${stakesCount} STAKES!)` : ""}`;
        return {
            userId: ownerId,
            type: "show_card",
            actorId: null,
            content,
            horseId: cards[0].horseId,
            linkUrl:
                single?.code ? `/cards/${single.code}` : `/stable/${cards[0].horseId}`,
        };
    });
}

/**
 * Staff added → poke the appointee with their role. Judges deep-link
 * straight to their bench; everyone else lands on the console.
 */
export function buildStaffAddedPlan(input: {
    showId: string;
    showTitle: string;
    userId: string;
    role: StaffRole;
    addedByUserId: string;
    addedByAlias: string;
}): NotificationInput {
    const roleName = formatRole(input.role);
    return {
        userId: input.userId,
        type: "show_staff",
        actorId: input.addedByUserId,
        content: `🤝 @${input.addedByAlias} added you as ${roleName} for ${input.showTitle}`,
        linkUrl:
            input.role === "judge"
                ? `/shows/host/${input.showId}/judge`
                : `/shows/host/${input.showId}`,
    };
}

/**
 * Class split/combined → tell owners of MOVED live entries where
 * their entry now lives, old name(s) → new name.
 */
export function buildClassChangePlans(input: {
    showId: string;
    showTitle: string;
    kind: "split" | "combined";
    oldClassNames: string[];
    newClassName: string;
    movedEntries: { ownerId: string; status: string }[];
}): NotificationInput[] {
    const owners = [
        ...new Set(
            input.movedEntries
                .filter((e) => e.status !== "scratched")
                .map((e) => e.ownerId),
        ),
    ];
    const oldNames = input.oldClassNames.map((n) => `"${n}"`).join(" and ");
    const content =
        input.kind === "split"
            ? `✂️ ${oldNames} was split at ${input.showTitle} — your entry now shows in "${input.newClassName}".`
            : `🪢 ${oldNames} were combined into "${input.newClassName}" at ${input.showTitle} — your entry moved with them.`;
    return owners.map((ownerId) => ({
        userId: ownerId,
        type: "show_class_change",
        actorId: null,
        content,
        // #entries — where the moved entry now shows.
        linkUrl: `/shows/${input.showId}#entries`,
    }));
}

/** Community voting opened → tell every live entrant the ring is open. */
export function buildVotingOpenPlans(input: {
    showId: string;
    showTitle: string;
    entries: { ownerId: string; status: string }[];
}): NotificationInput[] {
    const owners = [
        ...new Set(
            input.entries.filter((e) => e.status !== "scratched").map((e) => e.ownerId),
        ),
    ];
    return owners.map((ownerId) => ({
        userId: ownerId,
        type: "show_voting_open",
        actorId: null,
        content: `🗳️ Community voting is open at ${input.showTitle} — your entries are on the ring.`,
        // #gallery — straight to the hearts.
        linkUrl: `/shows/${input.showId}#gallery`,
    }));
}

/**
 * Online judged show entered judging → tell every judge-role staff
 * member their bench is ready, deep-linked to the queue. (The
 * voting-open plan above is the entrant side; this is the judge
 * side of the same flip.)
 */
export function buildJudgingOpenPlans(input: {
    showId: string;
    showTitle: string;
    judgeUserIds: string[];
}): NotificationInput[] {
    return [...new Set(input.judgeUserIds)].map((userId) => ({
        userId,
        type: "show_judging_open",
        actorId: null,
        content: `⚖️ Judging is open for ${input.showTitle} — your queue is ready.`,
        linkUrl: `/shows/host/${input.showId}/judge`,
    }));
}

/** Staff scratched an entry → tell its owner, with the reason if given. */
export function buildEntryScratchedPlan(input: {
    showId: string;
    showTitle: string;
    ownerId: string;
    horseName: string;
    className: string;
    scratchedByUserId: string;
    reason?: string | null;
}): NotificationInput {
    const reason = input.reason?.trim();
    return {
        userId: input.ownerId,
        type: "show_entry_scratched",
        actorId: input.scratchedByUserId,
        content: `Your entry ${input.horseName} in "${input.className}" was scratched by show staff at ${input.showTitle}.${reason ? ` Reason: ${reason}` : ""}`,
        // #entries — the scratched row stays visible there as history.
        linkUrl: `/shows/${input.showId}#entries`,
    };
}

/**
 * Announcement recipients: distinct owners of live (non-scratched)
 * entries, first-entry order. The bulk helper's self-guard drops the
 * announcing host's own row via actorId.
 */
export function deriveAnnouncementRecipients(
    entries: { ownerId: string; status: string }[],
): string[] {
    const owners: string[] = [];
    const seen = new Set<string>();
    for (const e of entries) {
        if (e.status === "scratched") continue;
        if (seen.has(e.ownerId)) continue;
        seen.add(e.ownerId);
        owners.push(e.ownerId);
    }
    return owners;
}

/** Host announcement → one notification per current entrant owner. */
export function buildAnnouncementPlans(input: {
    showId: string;
    showTitle: string;
    hostUserId: string;
    hostAlias: string;
    message: string;
    recipientIds: string[];
}): NotificationInput[] {
    return input.recipientIds.map((userId) => ({
        userId,
        type: "show_announcement",
        actorId: input.hostUserId,
        content: `📣 @${input.hostAlias} (${input.showTitle}): ${input.message}`,
        // #entries — announcements are almost always "about your entries".
        linkUrl: `/shows/${input.showId}#entries`,
    }));
}

/** Entries close within 24h → nudge every live entrant (cron dedupes). */
export function buildDeadlinePlans(input: {
    showId: string;
    showTitle: string;
    recipientIds: string[];
}): NotificationInput[] {
    return input.recipientIds.map((userId) => ({
        userId,
        type: "show_deadline",
        actorId: null,
        content: `⏰ Entries for ${input.showTitle} close in less than 24 hours.`,
        // #entries — the last-call landing spot.
        linkUrl: `/shows/${input.showId}#entries`,
    }));
}

/** Is `entriesCloseAt` inside the (now, now+24h] reminder window? */
export function isClosingWithin24h(
    entriesCloseAt: string | null,
    now: Date,
): boolean {
    if (!entriesCloseAt) return false;
    const closes = new Date(entriesCloseAt).getTime();
    if (Number.isNaN(closes)) return false;
    const delta = closes - now.getTime();
    return delta > 0 && delta <= 24 * 60 * 60 * 1000;
}

// ══════════════════════════════════════════════════════════════
// I/O orchestrators — called from after() blocks and the cron.
// Every one is fire-and-forget: it logs, it never throws.
// ══════════════════════════════════════════════════════════════

interface LoadedShowContext {
    title: string;
    entries: { id: string; ownerId: string; horseId: string; classId: string; status: string }[];
}

async function loadShowEntriesContext(
    client: SupabaseClient,
    showId: string,
): Promise<LoadedShowContext | { error: string }> {
    const { data: show, error: showError } = await client
        .from("shows")
        .select("id, title")
        .eq("id", showId)
        .maybeSingle();
    if (showError) return { error: showError.message };
    if (!show) return { error: "Show not found." };

    const { data: entryRows, error: entriesError } = await client
        .from("show_class_entries")
        .select("id, owner_id, horse_id, class_id, status")
        .eq("show_id", showId)
        .order("created_at", { ascending: true });
    if (entriesError) return { error: entriesError.message };

    return {
        title: show.title as string,
        entries: (entryRows ?? []).map((e) => ({
            id: e.id as string,
            ownerId: e.owner_id as string,
            horseId: e.horse_id as string,
            classId: e.class_id as string,
            status: e.status as string,
        })),
    };
}

/**
 * Results published (→ completed): notify EVERY distinct entrant
 * owner (placed and unplaced), notify card earners, then send the
 * results emails. `client` is the ADMIN client — this runs inside
 * `after()` once the response is gone, and the fan-out reads rows
 * (entries, placings, recipient prefs) across every entrant, which
 * no single user's RLS view can cover. The caller (the publishing
 * host) was already role-checked by transitionShowStatus.
 */
export async function runResultsPublishedFanout(
    client: SupabaseClient,
    showId: string,
    issuedCards: PlannedCard[],
): Promise<void> {
    try {
        const context = await loadShowEntriesContext(client, showId);
        if ("error" in context) {
            logger.error("ShowNotifications", `Results fan-out load failed: ${context.error}`);
            return;
        }

        const tree = await loadClassContexts(client, showId);
        if ("error" in tree) {
            logger.error("ShowNotifications", `Results fan-out classes failed: ${tree.error}`);
            return;
        }
        const classNamesById = new Map(tree.contexts.map((c) => [c.classId, c.className]));

        const liveEntryIds = context.entries
            .filter((e) => e.status !== "scratched")
            .map((e) => e.id);
        let placings: { entryId: string; place: number | null }[] = [];
        if (liveEntryIds.length > 0) {
            const { data: placingRows, error: placingsError } = await client
                .from("show_placings")
                .select("entry_id, place")
                .in("entry_id", liveEntryIds);
            if (placingsError) {
                logger.error(
                    "ShowNotifications",
                    `Results fan-out placings failed: ${placingsError.message}`,
                );
                return;
            }
            placings = (placingRows ?? []).map((p) => ({
                entryId: p.entry_id as string,
                place: (p.place as number | null) ?? null,
            }));
        }

        const horseNamesById = await getHorseNames(client, [
            ...context.entries.map((e) => e.horseId),
            ...issuedCards.map((c) => c.horseId),
        ]);
        if (!(horseNamesById instanceof Map)) {
            logger.error("ShowNotifications", `Results fan-out horses failed: ${horseNamesById.error}`);
            return;
        }

        const results = buildEntrantResults({
            entries: context.entries,
            placings,
            classNamesById,
            horseNamesById,
        });

        await createNotificationsBulk(
            buildResultsNotificationPlans({ showId, showTitle: context.title, results }),
        );

        if (issuedCards.length > 0) {
            await createNotificationsBulk(
                buildCardNotificationPlans({ cards: issuedCards, horseNamesById }),
            );
        }

        await sendShowResultsEmails({ showId, showTitle: context.title, results });
    } catch (err) {
        logger.error("ShowNotifications", "Results fan-out failed", err);
    }
}

/**
 * Community-vote show entered judging → "voting is open" fan-out.
 * Admin client for the same after()-lifecycle reason as above.
 */
export async function runVotingOpenedFanout(
    client: SupabaseClient,
    showId: string,
): Promise<void> {
    try {
        const context = await loadShowEntriesContext(client, showId);
        if ("error" in context) {
            logger.error("ShowNotifications", `Voting fan-out load failed: ${context.error}`);
            return;
        }
        await createNotificationsBulk(
            buildVotingOpenPlans({
                showId,
                showTitle: context.title,
                entries: context.entries,
            }),
        );
    } catch (err) {
        logger.error("ShowNotifications", "Voting-open fan-out failed", err);
    }
}

/**
 * Judged online show entered judging → tell its judges the queue is
 * ready. Admin client for the same after()-lifecycle reason as the
 * voting fan-out; the transition itself was already host-gated.
 */
export async function runJudgingOpenedFanout(
    client: SupabaseClient,
    showId: string,
): Promise<void> {
    try {
        const { data: show, error: showError } = await client
            .from("shows")
            .select("id, title")
            .eq("id", showId)
            .maybeSingle();
        if (showError || !show) {
            logger.error(
                "ShowNotifications",
                `Judging-open fan-out show load failed: ${showError?.message ?? "not found"}`,
            );
            return;
        }

        const { data: judgeRows, error: staffError } = await client
            .from("show_staff")
            .select("user_id")
            .eq("show_id", showId)
            .eq("role", "judge");
        if (staffError) {
            logger.error(
                "ShowNotifications",
                `Judging-open fan-out staff load failed: ${staffError.message}`,
            );
            return;
        }

        await createNotificationsBulk(
            buildJudgingOpenPlans({
                showId,
                showTitle: show.title as string,
                judgeUserIds: (judgeRows ?? []).map((r) => r.user_id as string),
            }),
        );
    } catch (err) {
        logger.error("ShowNotifications", "Judging-open fan-out failed", err);
    }
}

/**
 * Split/combine → notify owners of the moved live entries.
 * `moved` is either the explicit moved-entry ids (split) or the new
 * class id whose live entries all just arrived (combine).
 */
export async function runClassChangeFanout(
    client: SupabaseClient,
    input: {
        showId: string;
        kind: "split" | "combined";
        oldClassNames: string[];
        newClassName: string;
        moved: { entryIds: string[] } | { newClassId: string };
    },
): Promise<void> {
    try {
        const { data: show, error: showError } = await client
            .from("shows")
            .select("id, title")
            .eq("id", input.showId)
            .maybeSingle();
        if (showError || !show) {
            logger.error(
                "ShowNotifications",
                `Class-change fan-out show load failed: ${showError?.message ?? "not found"}`,
            );
            return;
        }

        let query = client
            .from("show_class_entries")
            .select("id, owner_id, status");
        query =
            "entryIds" in input.moved
                ? query.in("id", input.moved.entryIds)
                : query.eq("class_id", input.moved.newClassId);
        const { data: entryRows, error: entriesError } = await query;
        if (entriesError) {
            logger.error(
                "ShowNotifications",
                `Class-change fan-out entries failed: ${entriesError.message}`,
            );
            return;
        }

        await createNotificationsBulk(
            buildClassChangePlans({
                showId: input.showId,
                showTitle: show.title as string,
                kind: input.kind,
                oldClassNames: input.oldClassNames,
                newClassName: input.newClassName,
                movedEntries: (entryRows ?? []).map((e) => ({
                    ownerId: e.owner_id as string,
                    status: e.status as string,
                })),
            }),
        );
    } catch (err) {
        logger.error("ShowNotifications", "Class-change fan-out failed", err);
    }
}

/** Staff appointment → single targeted notification. */
export async function runStaffAddedNotification(
    client: SupabaseClient,
    input: {
        showId: string;
        userId: string;
        role: StaffRole;
        addedByUserId: string;
    },
): Promise<void> {
    try {
        const { data: show } = await client
            .from("shows")
            .select("id, title")
            .eq("id", input.showId)
            .maybeSingle();
        if (!show) return;
        const aliases = await getAliases(client, [input.addedByUserId]);
        const addedByAlias =
            aliases instanceof Map
                ? (aliases.get(input.addedByUserId) ?? "unknown")
                : "unknown";
        await createNotification(
            buildStaffAddedPlan({
                showId: input.showId,
                showTitle: show.title as string,
                userId: input.userId,
                role: input.role,
                addedByUserId: input.addedByUserId,
                addedByAlias,
            }),
        );
    } catch (err) {
        logger.error("ShowNotifications", "Staff-added notification failed", err);
    }
}

/** Staff scratch → single targeted notification to the entry owner. */
export async function runEntryScratchedNotification(
    client: SupabaseClient,
    input: {
        showId: string;
        classId: string;
        horseId: string;
        ownerId: string;
        scratchedByUserId: string;
        reason?: string | null;
    },
): Promise<void> {
    try {
        const [{ data: show }, { data: cls }, horseNames] = await Promise.all([
            client.from("shows").select("id, title").eq("id", input.showId).maybeSingle(),
            client.from("show_classes").select("id, name").eq("id", input.classId).maybeSingle(),
            getHorseNames(client, [input.horseId]),
        ]);
        if (!show) return;
        await createNotification(
            buildEntryScratchedPlan({
                showId: input.showId,
                showTitle: show.title as string,
                ownerId: input.ownerId,
                horseName:
                    horseNames instanceof Map
                        ? (horseNames.get(input.horseId) ?? "Your horse")
                        : "Your horse",
                className: (cls?.name as string | undefined) ?? "a class",
                scratchedByUserId: input.scratchedByUserId,
                reason: input.reason ?? null,
            }),
        );
    } catch (err) {
        logger.error("ShowNotifications", "Scratch notification failed", err);
    }
}
