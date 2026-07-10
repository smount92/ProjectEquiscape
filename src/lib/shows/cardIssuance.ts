/**
 * Shows domain — qualification-card ISSUANCE (Phase F).
 *
 * Two layers:
 *   1. buildCardIssuePlan — pure: decides which cards a show's
 *      results earn (1st/2nd, qualifying class, qualifying show,
 *      live entries only, minus cards already issued).
 *   2. issueQualificationCardsForShow — I/O orchestration on the
 *      CALLER'S client. RLS-first by design: migration 118's
 *      "Managers issue cards" INSERT policy was built for exactly
 *      this (host/co_host + class-belongs-to-show + a REAL 1st/2nd
 *      placing for that horse) — no admin client anywhere.
 *
 * Idempotency (publish must stay retryable): the plan skips
 * (class, horse) pairs that already hold a card, and the DB's
 * UNIQUE(class_id, horse_id) + short-code PK back the check up.
 * A concurrent double-publish that slips past the existence check
 * re-plans once and retries.
 */

import type { SupabaseClient } from "@supabase/supabase-js";

import { generateCardCode, shouldIssueCard } from "./cards";
import type { EntryStatus, Place } from "./types";

// ── The pure plan ──

export interface CardIssueInput {
    show: {
        id: string;
        isMhhQualifying: boolean;
        showYear: number | null;
    };
    classes: { id: string; isQualifying: boolean }[];
    /** LIVE entries preferred, but scratched rows are tolerated and skipped. */
    entries: {
        id: string;
        classId: string;
        horseId: string;
        ownerId: string;
        status: EntryStatus;
    }[];
    placings: { entryId: string; classId: string; place: Place | null }[];
    /** Cards already issued for this show — the idempotency skip-list. */
    existingCards: { classId: string; horseId: string }[];
}

export interface PlannedCard {
    classId: string;
    horseId: string;
    earnedPlace: 1 | 2;
    /** The entry's owner AT ISSUANCE — frozen as earned_by_owner_id. */
    ownerId: string;
}

export function buildCardIssuePlan(input: CardIssueInput): {
    cards: PlannedCard[];
    skippedExisting: number;
} {
    // Host opted out — the whole show issues nothing.
    if (!input.show.isMhhQualifying) return { cards: [], skippedExisting: 0 };

    const entryById = new Map(input.entries.map((e) => [e.id, e]));
    const classById = new Map(input.classes.map((c) => [c.id, c]));
    const alreadyIssued = new Set(
        input.existingCards.map((c) => `${c.classId}::${c.horseId}`),
    );
    // One card per horse per class (matches UNIQUE(class_id, horse_id)).
    const planned = new Set<string>();

    const cards: PlannedCard[] = [];
    let skippedExisting = 0;

    for (const placing of input.placings) {
        const entry = entryById.get(placing.entryId);
        const cls = classById.get(placing.classId);
        // Data drift (placing on an unknown entry/class) never mints.
        if (!entry || !cls) continue;

        if (
            !shouldIssueCard({
                place: placing.place,
                classIsQualifying: cls.isQualifying,
                showIsMhhQualifying: input.show.isMhhQualifying,
                entryStatus: entry.status,
            })
        ) {
            continue;
        }

        const key = `${placing.classId}::${entry.horseId}`;
        if (alreadyIssued.has(key)) {
            skippedExisting += 1;
            continue;
        }
        if (planned.has(key)) continue;
        planned.add(key);

        cards.push({
            classId: placing.classId,
            horseId: entry.horseId,
            earnedPlace: placing.place as 1 | 2,
            ownerId: entry.ownerId,
        });
    }

    return { cards, skippedExisting };
}

// ── Short-code assignment (collision-checked) ──

export const CODE_ASSIGN_MAX_ATTEMPTS = 5;

/**
 * Produce `count` short codes that are unique among themselves AND
 * not already taken (per the injected lookup — a DB query in prod,
 * a stub in tests). Regenerates only the colliding slots, up to
 * CODE_ASSIGN_MAX_ATTEMPTS rounds.
 */
export async function assignCardCodes(
    count: number,
    isTaken: (codes: string[]) => Promise<Set<string>>,
    random: () => number = Math.random,
): Promise<string[] | { error: string }> {
    const codes: (string | null)[] = new Array(count).fill(null);

    for (let attempt = 0; attempt < CODE_ASSIGN_MAX_ATTEMPTS; attempt++) {
        // Seed with codes kept from earlier rounds so a regenerated
        // slot can never duplicate a surviving one.
        const batch = new Set<string>(codes.filter((c): c is string => c !== null));
        for (let i = 0; i < count; i++) {
            if (codes[i] !== null) continue;
            let candidate = generateCardCode(random);
            // In-batch collisions roll again locally (bounded so a
            // degenerate random source can never spin forever).
            for (let roll = 0; batch.has(candidate) && roll < 100; roll++) {
                candidate = generateCardCode(random);
            }
            if (batch.has(candidate)) {
                return { error: "Could not generate unique card codes." };
            }
            batch.add(candidate);
            codes[i] = candidate;
        }

        const pending = codes.filter((c): c is string => c !== null);
        const taken = await isTaken(pending);
        if (taken.size === 0) return codes as string[];

        for (let i = 0; i < count; i++) {
            if (codes[i] !== null && taken.has(codes[i] as string)) codes[i] = null;
        }
        if (!codes.includes(null)) return codes as string[];
    }

    return {
        error: "Could not generate unique card codes — please try publishing again.",
    };
}

// ── I/O orchestration (caller's client; RLS gates every row) ──

interface IssueResult {
    issued: number;
    skipped: number;
}

export async function issueQualificationCardsForShow(
    supabase: SupabaseClient,
    showId: string,
    random: () => number = Math.random,
): Promise<IssueResult | { error: string }> {
    // ── Show: qualifying flag + denormalized show year ──
    const { data: show, error: showError } = await supabase
        .from("shows")
        .select("id, is_mhh_qualifying, show_year")
        .eq("id", showId)
        .maybeSingle();
    if (showError) return { error: showError.message };
    if (!show) return { error: "Show not found." };
    if (!show.is_mhh_qualifying) return { issued: 0, skipped: 0 };

    // ── Classlist (ids + qualifying flags only) ──
    const { data: divisionRows, error: dErr } = await supabase
        .from("show_divisions")
        .select("id")
        .eq("show_id", showId);
    if (dErr) return { error: dErr.message };
    const divisionIds = (divisionRows ?? []).map((d: { id: string }) => d.id);
    if (divisionIds.length === 0) return { issued: 0, skipped: 0 };

    const { data: sectionRows, error: sErr } = await supabase
        .from("show_sections")
        .select("id")
        .in("division_id", divisionIds);
    if (sErr) return { error: sErr.message };
    const sectionIds = (sectionRows ?? []).map((s: { id: string }) => s.id);
    if (sectionIds.length === 0) return { issued: 0, skipped: 0 };

    const { data: classRows, error: cErr } = await supabase
        .from("show_classes")
        .select("id, is_qualifying")
        .in("section_id", sectionIds);
    if (cErr) return { error: cErr.message };
    const classes = (classRows ?? []) as { id: string; is_qualifying: boolean }[];
    if (classes.length === 0) return { issued: 0, skipped: 0 };

    // ── Entries + placings + already-issued cards ──
    const { data: entryRows, error: eErr } = await supabase
        .from("show_class_entries")
        .select("id, class_id, horse_id, owner_id, status")
        .eq("show_id", showId);
    if (eErr) return { error: eErr.message };

    const { data: placingRows, error: pErr } = await supabase
        .from("show_placings")
        .select("entry_id, class_id, place")
        .in("class_id", classes.map((c) => c.id));
    if (pErr) return { error: pErr.message };

    const loadExisting = async (): Promise<
        { classId: string; horseId: string }[] | { error: string }
    > => {
        // Host/co-host reads ride the managers branch of the cards
        // SELECT policy (118) — the publisher always sees this show's cards.
        const { data, error } = await supabase
            .from("qualification_cards")
            .select("class_id, horse_id")
            .eq("show_id", showId);
        if (error) return { error: error.message };
        return (data ?? []).map((r: { class_id: string; horse_id: string }) => ({
            classId: r.class_id,
            horseId: r.horse_id,
        }));
    };

    const existing = await loadExisting();
    if ("error" in existing) return { error: existing.error };

    const toInput = (
        existingCards: { classId: string; horseId: string }[],
    ): CardIssueInput => ({
        show: {
            id: show.id as string,
            isMhhQualifying: show.is_mhh_qualifying as boolean,
            showYear: (show.show_year as number | null) ?? null,
        },
        classes: classes.map((c) => ({ id: c.id, isQualifying: c.is_qualifying })),
        entries: (entryRows ?? []).map(
            (e: {
                id: string;
                class_id: string;
                horse_id: string;
                owner_id: string;
                status: string;
            }) => ({
                id: e.id,
                classId: e.class_id,
                horseId: e.horse_id,
                ownerId: e.owner_id,
                status: e.status as EntryStatus,
            }),
        ),
        placings: (placingRows ?? []).map(
            (p: { entry_id: string; class_id: string; place: number | null }) => ({
                entryId: p.entry_id,
                classId: p.class_id,
                place: (p.place as Place | null) ?? null,
            }),
        ),
        existingCards,
    });

    const insertPlan = async (plan: {
        cards: PlannedCard[];
        skippedExisting: number;
    }): Promise<IssueResult | { error: string } | "conflict"> => {
        if (plan.cards.length === 0) {
            return { issued: 0, skipped: plan.skippedExisting };
        }

        const codes = await assignCardCodes(
            plan.cards.length,
            async (candidates) => {
                const { data, error } = await supabase
                    .from("qualification_cards")
                    .select("id")
                    .in("id", candidates);
                if (error) throw new Error(error.message);
                return new Set((data ?? []).map((r: { id: string }) => r.id));
            },
            random,
        ).catch((err: Error) => ({ error: err.message }));
        if (!Array.isArray(codes)) return { error: codes.error };

        const rows = plan.cards.map((card, i) => ({
            id: codes[i],
            show_id: showId,
            class_id: card.classId,
            horse_id: card.horseId,
            earned_place: card.earnedPlace,
            earned_by_owner_id: card.ownerId,
            current_owner_id: card.ownerId,
            status: "issued",
            show_year: (show.show_year as number | null) ?? null,
        }));

        const { error: insertError } = await supabase
            .from("qualification_cards")
            .insert(rows);
        if (insertError) {
            // 23505 = a concurrent publish (or code race) won — re-plan once.
            if ((insertError as { code?: string }).code === "23505") return "conflict";
            return { error: insertError.message };
        }
        return { issued: rows.length, skipped: plan.skippedExisting };
    };

    const first = await insertPlan(buildCardIssuePlan(toInput(existing)));
    if (first !== "conflict") return first;

    // Unique-violation race: reload the issued set and try once more
    // with fresh codes. A second conflict is a real error.
    const refreshed = await loadExisting();
    if ("error" in refreshed) return { error: refreshed.error };
    const second = await insertPlan(buildCardIssuePlan(toInput(refreshed)));
    if (second === "conflict") {
        return {
            error: "Card issuance hit repeated conflicts — please try publishing again.",
        };
    }
    return second;
}
