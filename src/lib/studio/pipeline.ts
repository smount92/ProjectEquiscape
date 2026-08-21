/**
 * The commission pipeline — pure, no I/O, no Supabase, no React.
 *
 * This module is the single source of truth for what a commission can do
 * next and who is allowed to do it. The server action imports it to ENFORCE
 * the machine; the UI imports it to RENDER the available moves. They can
 * never drift, because there is only one table.
 *
 * Shape comes from docs/studio/COMMISSION_RESEARCH.md: every real commission
 * flow is inquiry -> quote -> agreement -> work -> approval -> delivery, and
 * the ball is always in exactly one court. v1 had no quote stage at all (the
 * CLIENT set the artist's price), and its only client-side action was blocked
 * by RLS. Both are fixed here.
 */

// ── Statuses ──────────────────────────────────────────────────────────

/** The live pipeline. Ordered — index doubles as progress. */
export const COMMISSION_STATUSES = [
    "requested",
    "quoted",
    "accepted",
    "in_progress",
    "awaiting_approval",
    "completed",
    "delivered",
] as const;

/** Ways a commission can end early. Not part of the progress ladder. */
export const CLOSED_STATUSES = ["declined", "cancelled"] as const;

export type CommissionStatus =
    | (typeof COMMISSION_STATUSES)[number]
    | (typeof CLOSED_STATUSES)[number];

/**
 * v1 statuses that rows in the database may still carry. We never WRITE
 * these, but existing data must render, so every read normalises through
 * `normalizeStatus`. (`review` was the old awaiting-approval; `revision`
 * was a separate state rather than a counted loop; `shipping` was one
 * status doing two opposite jobs — see research doc 4.2.6.)
 */
export const LEGACY_STATUS_MAP: Record<string, CommissionStatus> = {
    review: "awaiting_approval",
    revision: "in_progress",
    shipping: "completed",
};

export function normalizeStatus(raw: string | null | undefined): CommissionStatus {
    if (!raw) return "requested";
    if (raw in LEGACY_STATUS_MAP) return LEGACY_STATUS_MAP[raw];
    return (COMMISSION_STATUSES as readonly string[]).includes(raw) ||
        (CLOSED_STATUSES as readonly string[]).includes(raw)
        ? (raw as CommissionStatus)
        : "requested";
}

export function isTerminal(status: CommissionStatus): boolean {
    return status === "delivered" || status === "declined" || status === "cancelled";
}

/** Work that counts against an artist's slots — i.e. actually on the bench. */
export const ACTIVE_STATUSES: CommissionStatus[] = [
    "accepted",
    "in_progress",
    "awaiting_approval",
];

/** Work that counts as earned. Income rollups use exactly this set. */
export const EARNED_STATUSES: CommissionStatus[] = ["completed", "delivered"];

// ── Who holds the ball ────────────────────────────────────────────────

export type Party = "artist" | "client";

/**
 * The party whose move it is. Rendering this honestly is most of what makes
 * a pipeline board readable: "waiting on them" vs "waiting on you".
 */
export function ballIsWith(status: CommissionStatus): Party | null {
    switch (status) {
        case "requested":
            return "artist"; // triage: quote it or decline it
        case "quoted":
            return "client"; // accept those terms, or walk away
        case "accepted":
        case "in_progress":
            return "artist";
        case "awaiting_approval":
            return "client"; // sign off, or spend a revision
        case "completed":
            return "artist"; // hand it over / ship it
        default:
            return null; // delivered, declined, cancelled
    }
}

// ── Transitions ───────────────────────────────────────────────────────

export interface Transition {
    to: CommissionStatus;
    /** Who may perform it. */
    by: Party[];
    /** Button label for the actor. */
    label: string;
    emoji: string;
    /** Destructive moves get a confirm step and a muted style. */
    destructive?: boolean;
    /**
     * Kill-fee territory: leaving an ACCEPTED agreement, rather than
     * declining before one existed. The UI shows the agreed cancellation
     * terms at this moment (research doc 1.3).
     */
    afterAgreement?: boolean;
    /** Consumes one of the agreed revisions. */
    consumesRevision?: boolean;
}

/**
 * The machine. Every legal move, keyed by the status you are leaving.
 *
 * Note `awaiting_approval -> in_progress` is the revision loop, owned by the
 * CLIENT and counted. v1 had a separate `revision` status that nothing
 * tallied, which is the commonest source of commission disputes.
 */
export const TRANSITIONS: Record<CommissionStatus, Transition[]> = {
    requested: [
        { to: "quoted", by: ["artist"], label: "Send a quote", emoji: "📝" },
        { to: "declined", by: ["artist"], label: "Decline", emoji: "✕", destructive: true },
        {
            to: "cancelled",
            by: ["client"],
            label: "Withdraw request",
            emoji: "↩",
            destructive: true,
        },
    ],
    quoted: [
        { to: "accepted", by: ["client"], label: "Accept these terms", emoji: "🤝" },
        {
            to: "declined",
            by: ["client"],
            label: "Decline the quote",
            emoji: "✕",
            destructive: true,
        },
        {
            to: "quoted",
            by: ["artist"],
            label: "Revise the quote",
            emoji: "✎",
        },
        { to: "declined", by: ["artist"], label: "Withdraw", emoji: "✕", destructive: true },
    ],
    accepted: [
        { to: "in_progress", by: ["artist"], label: "Start work", emoji: "🎨" },
        {
            to: "cancelled",
            by: ["artist", "client"],
            label: "Cancel commission",
            emoji: "🚫",
            destructive: true,
            afterAgreement: true,
        },
    ],
    in_progress: [
        {
            to: "awaiting_approval",
            by: ["artist"],
            label: "Submit for approval",
            emoji: "📤",
        },
        {
            to: "cancelled",
            by: ["artist", "client"],
            label: "Cancel commission",
            emoji: "🚫",
            destructive: true,
            afterAgreement: true,
        },
    ],
    awaiting_approval: [
        { to: "completed", by: ["client"], label: "Approve the work", emoji: "✅" },
        {
            to: "in_progress",
            by: ["client"],
            label: "Request a revision",
            emoji: "✎",
            consumesRevision: true,
        },
        {
            to: "cancelled",
            by: ["artist", "client"],
            label: "Cancel commission",
            emoji: "🚫",
            destructive: true,
            afterAgreement: true,
        },
    ],
    completed: [
        { to: "delivered", by: ["artist"], label: "Mark delivered", emoji: "📦" },
    ],
    delivered: [],
    declined: [],
    cancelled: [],
};

/** Every move `party` may make from `status`, in display order. */
export function availableTransitions(
    status: CommissionStatus,
    party: Party,
): Transition[] {
    return (TRANSITIONS[status] ?? []).filter((t) => t.by.includes(party));
}

export interface TransitionCheck {
    ok: boolean;
    /** Present when ok — the matched rule, so callers can read its flags. */
    transition?: Transition;
    /** Present when !ok — a sentence safe to show the user. */
    error?: string;
}

/**
 * The authoritative guard. The server action calls exactly this before it
 * writes; nothing else decides whether a move is legal.
 */
export function canTransition(
    from: CommissionStatus,
    to: CommissionStatus,
    party: Party,
): TransitionCheck {
    const rules = TRANSITIONS[from] ?? [];
    if (rules.length === 0) {
        return {
            ok: false,
            error: `This commission is ${STATUS_LABELS[from].toLowerCase()} and can't be changed.`,
        };
    }

    const match = rules.find((r) => r.to === to && r.by.includes(party));
    if (match) return { ok: true, transition: match };

    // Distinguish "not your move" from "not a move at all" — the first is a
    // permission message, the second is a stale-page message.
    const existsForOther = rules.some((r) => r.to === to);
    if (existsForOther) {
        const holder = ballIsWith(from);
        return {
            ok: false,
            error:
                holder && holder !== party
                    ? `That's the ${holder === "artist" ? "artist" : "commissioner"}'s move to make.`
                    : "You can't make that change.",
        };
    }
    return {
        ok: false,
        error: `Can't go from ${STATUS_LABELS[from]} to ${STATUS_LABELS[to] ?? to}.`,
    };
}

// ── Presentation ──────────────────────────────────────────────────────

export const STATUS_LABELS: Record<CommissionStatus, string> = {
    requested: "Requested",
    quoted: "Quoted",
    accepted: "Accepted",
    in_progress: "In progress",
    awaiting_approval: "Awaiting approval",
    completed: "Completed",
    delivered: "Delivered",
    declined: "Declined",
    cancelled: "Cancelled",
};

/** One line explaining the state, written for whichever side is reading. */
export function statusBlurb(status: CommissionStatus, viewer: Party): string {
    const yours = ballIsWith(status) === viewer;
    switch (status) {
        case "requested":
            return yours
                ? "Quote it or decline — the commissioner is waiting."
                : "Sent. The artist will quote or decline it.";
        case "quoted":
            return yours
                ? "Review the price, timeline and terms, then accept or decline."
                : "Quote sent. Waiting on the commissioner.";
        case "accepted":
            return yours
                ? "Terms agreed. Start work when you're ready."
                : "Terms agreed. The artist will start work.";
        case "in_progress":
            return yours
                ? "On the bench. Post WIP updates as you go."
                : "On the bench — watch for WIP updates here.";
        case "awaiting_approval":
            return yours
                ? "Approve the work, or spend a revision asking for changes."
                : "Submitted. Waiting on the commissioner's sign-off.";
        case "completed":
            return yours
                ? "Approved. Mark it delivered once it's handed over."
                : "Approved. The artist will hand it over.";
        case "delivered":
            return "Delivered. This commission is closed.";
        case "declined":
            return "Declined. No agreement was made.";
        case "cancelled":
            return "Cancelled after the terms were agreed.";
    }
}

/** 0-1 progress along the live ladder. Closed statuses report their exit point. */
export function progress(status: CommissionStatus): number {
    if (status === "declined" || status === "cancelled") return 0;
    const i = (COMMISSION_STATUSES as readonly string[]).indexOf(status);
    if (i < 0) return 0;
    return i / (COMMISSION_STATUSES.length - 1);
}

// ── Revisions ─────────────────────────────────────────────────────────

export interface RevisionState {
    used: number;
    included: number;
    remaining: number;
    /** Past the agreed allowance — the artist may bill for this one. */
    overAllowance: boolean;
    label: string;
}

export function revisionState(used: number, included: number): RevisionState {
    const u = Math.max(0, Math.floor(used || 0));
    const inc = Math.max(0, Math.floor(included || 0));
    const remaining = Math.max(0, inc - u);
    return {
        used: u,
        included: inc,
        remaining,
        overAllowance: u >= inc,
        label:
            inc === 0
                ? `${u} revision${u === 1 ? "" : "s"} (none included)`
                : `${u} of ${inc} revision${inc === 1 ? "" : "s"} used`,
    };
}

// ── Slots ─────────────────────────────────────────────────────────────

export type StudioStatus = "open" | "waitlist" | "closed";

export interface SlotState {
    used: number;
    max: number;
    open: number;
    full: boolean;
    /**
     * The status a visitor should actually see. Slots are for capacity and
     * transparency: when the bench is full an OPEN studio presents as a
     * WAITLIST rather than vanishing, so the artist keeps the demand signal
     * (research doc 1.2). A CLOSED studio stays closed.
     */
    effectiveStatus: StudioStatus;
    label: string;
}

export function slotState(
    used: number,
    max: number,
    declared: StudioStatus,
): SlotState {
    const u = Math.max(0, Math.floor(used || 0));
    const m = Math.max(0, Math.floor(max || 0));
    const full = m > 0 && u >= m;
    const effectiveStatus: StudioStatus =
        declared === "closed" ? "closed" : full ? "waitlist" : declared;
    return {
        used: u,
        max: m,
        open: Math.max(0, m - u),
        full,
        effectiveStatus,
        label: m > 0 ? `${u} of ${m} slots filled` : `${u} on the bench`,
    };
}

export const STUDIO_STATUS_LABELS: Record<StudioStatus, string> = {
    open: "Open for commissions",
    waitlist: "Waitlist open",
    closed: "Commissions closed",
};

/**
 * A request may be sent unless the studio is closed. When the bench is full
 * the request is flagged as a WAITLIST request rather than refused — refusing
 * outright throws away exactly the demand the artist wants to see.
 *
 * `waitlistOpen` is the artist's opt-out: some artists genuinely do not want
 * a queue behind the queue, and forcing one on them is worse than a closed
 * sign. It only applies once the bench is actually full — an artist who
 * declared WAITLIST as their status has already said yes to a waitlist.
 */
export function intakeFor(
    slots: SlotState,
    waitlistOpen = true,
): {
    accepting: boolean;
    asWaitlist: boolean;
    reason: string;
} {
    if (slots.effectiveStatus === "closed") {
        return {
            accepting: false,
            asWaitlist: false,
            reason: "This studio isn't taking commissions right now.",
        };
    }
    if (slots.effectiveStatus === "waitlist") {
        if (slots.full && !waitlistOpen) {
            return {
                accepting: false,
                asWaitlist: false,
                reason: "This studio's bench is full and it isn't keeping a waitlist.",
            };
        }
        return {
            accepting: true,
            asWaitlist: true,
            reason: slots.full
                ? "The bench is full — new requests join the waitlist."
                : "This studio is taking waitlist requests.",
        };
    }
    return { accepting: true, asWaitlist: false, reason: "This studio is open." };
}
