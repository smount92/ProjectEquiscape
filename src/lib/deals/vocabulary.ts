/**
 * THE AGREEMENT VOCABULARY — one set of words the whole site speaks.
 * Pure, no I/O.
 *
 * Model Horse Hub strikes three kinds of deal and, until now, described
 * each one with its own private noun set:
 *
 *   selling      transactions.status  offer_made → pending_payment →
 *                                     funds_verified → completed
 *                (party_a = seller, party_b = buyer — migration 099)
 *   commissions  commissions.status   requested → quoted → accepted →
 *                                     in_progress → awaiting_approval →
 *                                     completed → delivered
 *                (artist_id, client_id — migration 170)
 *   trades       nothing at all
 *
 * Three vocabularies means three UIs, three mental models, and no way to
 * say "this deal is waiting on you" in one sentence. This module is the
 * translation layer: every deal, whatever its kind, reports one of eight
 * DealStages and two parties (A and B) whose LABELS change per kind but
 * whose MEANING never does.
 *
 * The rule that decides which party is which is inherited from the
 * transactions table rather than invented here:
 *
 *   party A — the one who HAS the thing (seller / artist / the trader
 *             whose horse was asked about). Receives money.
 *   party B — the one who WANTS the thing (buyer / commissioner /
 *             the trader who asked). Sends money.
 *
 * Nothing in this file is a rule about what the parties must agree to.
 * We render and record their terms; we never author them.
 */

// ── Kinds ─────────────────────────────────────────────────────────────

export const DEAL_KINDS = ["sale", "commission", "trade"] as const;
export type DealKind = (typeof DEAL_KINDS)[number];

/** Party A or party B. Mirrors transactions.party_a_id / party_b_id. */
export type DealParty = "a" | "b";

export function otherParty(party: DealParty): DealParty {
    return party === "a" ? "b" : "a";
}

// ── Stages ────────────────────────────────────────────────────────────

/**
 * The eight stages every deal passes through, in order. These describe
 * the AGREEMENT, not the work: an artist mid-paint and a seller waiting
 * on the post office are both `fulfilling`, because in both cases the
 * terms are settled and the thing is on its way.
 */
export const DEAL_STAGES = [
    /** A conversation with no agreement in it yet. */
    "talking",
    /** An offer, quote or trade proposal is on the table, awaiting a reply. */
    "proposed",
    /** Both sides have agreed a price. Terms may still be being written. */
    "agreed",
    /** Money is moving — in one payment or across an installment plan. */
    "paying",
    /** Money is settled; the thing is being made, shipped or claimed. */
    "fulfilling",
    /** Done. Both sides got what they agreed to. */
    "settled",
    /** Ended without completing — declined, retracted, cancelled, expired. */
    "closed",
    /** Frozen and preserved because someone says it went wrong. */
    "disputed",
] as const;

export type DealStage = (typeof DEAL_STAGES)[number];

/** Stages with nothing further to do. */
export const TERMINAL_STAGES: readonly DealStage[] = ["settled", "closed"];

export function isTerminalStage(stage: DealStage): boolean {
    return TERMINAL_STAGES.includes(stage);
}

/**
 * Position in the ladder, for progress rendering. `disputed` deliberately
 * has no position — a dispute is a state the deal is held in, not a step
 * along the way.
 */
export function stageIndex(stage: DealStage): number {
    if (stage === "disputed") return -1;
    return DEAL_STAGES.indexOf(stage);
}

const STAGE_LABELS: Record<DealStage, string> = {
    talking: "Talking",
    proposed: "Offer on the table",
    agreed: "Agreed",
    paying: "Payment",
    fulfilling: "On its way",
    settled: "Settled",
    closed: "Closed",
    disputed: "Disputed",
};

export function stageLabel(stage: DealStage): string {
    return STAGE_LABELS[stage];
}

// ── Translating the existing state machines into the vocabulary ───────

/**
 * A Safe-Trade transaction's status becomes a stage.
 *
 * `pending_payment` splits on `paidAt`: the buyer self-attesting that
 * money left their account is the moment the deal stops being "agreed"
 * and starts being "paying". (The OfferCard already rendered off paid_at
 * rather than status for exactly this reason.)
 */
export function stageForTransaction(input: {
    status: string;
    paidAt?: string | null;
    disputedAt?: string | null;
}): DealStage {
    if (input.disputedAt) return "disputed";
    switch (input.status) {
        case "offer_made":
            return "proposed";
        case "pending_payment":
            return input.paidAt ? "paying" : "agreed";
        case "funds_verified":
            return "fulfilling";
        case "completed":
            return "settled";
        case "cancelled":
            return "closed";
        // 'pending' is the legacy pre-state-machine status still written
        // by createTransaction for conversation-based flows.
        case "pending":
        default:
            return "talking";
    }
}

/**
 * A commission's status becomes the same stage vocabulary. Legacy values
 * (review / revision / shipping, kept readable by migration 170) map
 * through their modern equivalents.
 */
export function stageForCommission(status: string): DealStage {
    switch (status) {
        case "requested":
        case "quoted":
            return "proposed";
        case "accepted":
            return "agreed";
        case "in_progress":
        case "awaiting_approval":
        case "completed":
        case "review":
        case "revision":
        case "shipping":
            return "fulfilling";
        case "delivered":
            return "settled";
        case "declined":
        case "cancelled":
            return "closed";
        default:
            return "talking";
    }
}

// ── Who is who ────────────────────────────────────────────────────────

interface KindVocabulary {
    /** What this kind of deal is called in a sentence. */
    noun: string;
    /** Party A — the one who has the thing and receives the money. */
    labelA: string;
    /** Party B — the one who wants the thing and sends the money. */
    labelB: string;
    /**
     * Which party owes money under the ordinary shape of this deal.
     * `null` for trades: a horse-for-horse swap may involve no money at
     * all, or "boot" going either way, and only the parties' own terms
     * can say which.
     */
    payer: DealParty | null;
}

const VOCABULARY: Record<DealKind, KindVocabulary> = {
    sale: { noun: "sale", labelA: "Seller", labelB: "Buyer", payer: "b" },
    commission: { noun: "commission", labelA: "Artist", labelB: "Commissioner", payer: "b" },
    trade: { noun: "trade", labelA: "Trader", labelB: "Trader", payer: null },
};

export function dealNoun(kind: DealKind): string {
    return VOCABULARY[kind].noun;
}

/** "Seller" / "Buyer" / "Artist" / "Commissioner" / "Trader". */
export function roleLabel(kind: DealKind, party: DealParty): string {
    const v = VOCABULARY[kind];
    return party === "a" ? v.labelA : v.labelB;
}

/**
 * Which party sends money under this kind of deal, if the kind decides
 * it at all. Trades return null — read the terms, not the kind.
 */
export function payerParty(kind: DealKind): DealParty | null {
    return VOCABULARY[kind].payer;
}

/** Which party receives money, if the kind decides it. */
export function payeeParty(kind: DealKind): DealParty | null {
    const p = VOCABULARY[kind].payer;
    return p === null ? null : otherParty(p);
}

/**
 * Which party a viewer is, given the two user ids. Returns null for a
 * third party (a moderator reading a frozen thread, say).
 *
 * This replaces the inbox's `buyer_id === user.id` test, which asked
 * "did you click first?" and answered "you are the buyer" — the reason
 * the thread header has been labelling sellers as buyers since 2024.
 */
export function partyForUser(
    userId: string,
    parties: { aId: string | null; bId: string | null },
): DealParty | null {
    if (parties.aId && userId === parties.aId) return "a";
    if (parties.bId && userId === parties.bId) return "b";
    return null;
}

// ── Whose move is it ──────────────────────────────────────────────────

/**
 * The one party a stage is waiting on, or null when it is waiting on
 * nobody (terminal) or on both (terms being written, a dispute).
 *
 * `paying` deliberately points at party A: once the payer says the money
 * has gone, the ball is with the person who has to confirm it arrived.
 * The finer-grained answer for an installment plan comes from the ledger.
 */
export function waitingOn(stage: DealStage, kind: DealKind): DealParty | null {
    switch (stage) {
        case "proposed":
            // An offer from B is answered by A; the vocabulary treats the
            // responder as the holder of the thing in every kind.
            return "a";
        case "agreed": {
            // Waiting for money to move — the payer, when the kind names one.
            return payerParty(kind);
        }
        case "paying":
            return "a";
        case "fulfilling":
            return "b";
        default:
            return null;
    }
}

// ── Deal kinds from what the thread is attached to ────────────────────

/**
 * Infer the kind from the subject a conversation carries. A thread with
 * a commission is a commission; a thread whose terms name horses on both
 * sides is a trade; a thread about one horse is a sale. A thread about
 * nothing is not a deal at all.
 */
export function inferKind(subject: {
    commissionId?: string | null;
    horseId?: string | null;
    offeredHorseIds?: string[] | null;
}): DealKind | null {
    if (subject.commissionId) return "commission";
    if (subject.offeredHorseIds && subject.offeredHorseIds.length > 0) return "trade";
    if (subject.horseId) return "sale";
    return null;
}
