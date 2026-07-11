/**
 * Commerce domain — Safe-Trade transaction lifecycle. Pure, no I/O.
 * Mirrors src/lib/shows/stateMachine.ts.
 *
 * Encodes the status graph as ENFORCED TODAY by
 * src/app/actions/transactions.ts, the atomic RPCs
 * (make_offer_atomic / respond_to_offer_atomic, migration 099) and the
 * cleanup cron (cleanup_system_garbage, migration 092):
 *
 *   (makeOffer) → offer_made → pending_payment → funds_verified → completed
 *                     │              │                │
 *                     └──────────────┴────────────────┴──→ cancelled
 *
 * Party semantics (migration 099): party_a_id = SELLER, party_b_id = BUYER.
 *
 * 'pending' is the legacy pre-state-machine status still written by
 * createTransaction() for conversation-based flows. markPaymentSent does
 * NOT change status — it stamps paid_at as a substate of pending_payment
 * (the OfferCard renders "funds sent" off paid_at, not off status).
 *
 * Refusal reason strings are the EXACT strings the server actions
 * returned before this module existed — the UI surfaces them verbatim
 * and the action tests match on them, so they are part of the contract.
 */

export const TRANSACTION_STATUSES = [
    "pending", // legacy (migration 060 keeps it in the CHECK constraint)
    "offer_made",
    "pending_payment",
    "funds_verified",
    "completed",
    "cancelled",
] as const;

export type TransactionStatus = (typeof TRANSACTION_STATUSES)[number];

/** Statuses with no outgoing transitions. */
export const TERMINAL_STATUSES: readonly TransactionStatus[] = ["completed", "cancelled"];

export function isTerminal(status: TransactionStatus): boolean {
    return TERMINAL_STATUSES.includes(status);
}

/** Who may trigger a given action. */
export type TransactionActor = "buyer" | "seller" | "either" | "system";

export type TransitionResult =
    | { ok: true }
    | { ok: false; reason: string };

/**
 * Every state-changing operation on a Safe-Trade transaction.
 * The `system` actions never run through a user-facing server action —
 * they are listed so the full lifecycle lives in one place.
 */
export type CommerceAction =
    | "accept_offer" // respondToOffer("accept")
    | "decline_offer" // respondToOffer("decline")
    | "retract_offer" // retractOffer
    | "mark_payment_sent" // markPaymentSent (stamps paid_at, status unchanged)
    | "verify_funds" // verifyFundsAndRelease
    | "cancel_transaction" // cancelTransaction
    | "complete_transaction" // completeTransaction
    | "claim_completion" // claimParkedHorse closes funds_verified → completed
    | "auto_cancel_stale_offer"; // cleanup_system_garbage cron (offer_made > 7 days)

interface ActionSpec {
    actor: TransactionActor;
    /** Statuses the transaction must be in for the action to be legal. */
    from: readonly TransactionStatus[];
    /** Status the transaction moves to (may equal the current status). */
    to: TransactionStatus;
    /** Exact refusal string when the caller is not the required party. */
    wrongPartyReason: string;
    /** Exact refusal string when the transaction is in the wrong status. */
    wrongStatusReason: (status: TransactionStatus) => string;
}

export const COMMERCE_ACTIONS: Record<CommerceAction, ActionSpec> = {
    // ── Seller responds to an offer (authoritative check lives in
    //    respond_to_offer_atomic; this is the Node-side pre-check) ──
    accept_offer: {
        actor: "seller",
        from: ["offer_made"],
        to: "pending_payment",
        wrongPartyReason: "Only the seller can respond to an offer.",
        wrongStatusReason: (s) => `Offer is no longer pending — transaction is "${s}".`,
    },
    decline_offer: {
        actor: "seller",
        from: ["offer_made"],
        to: "cancelled",
        wrongPartyReason: "Only the seller can respond to an offer.",
        wrongStatusReason: (s) => `Offer is no longer pending — transaction is "${s}".`,
    },

    // ── Buyer retracts while the offer is still pending ──
    retract_offer: {
        actor: "buyer",
        from: ["offer_made"],
        to: "cancelled",
        wrongPartyReason: "Only the buyer can retract an offer.",
        wrongStatusReason: () => "Offer can only be retracted while pending.",
    },

    // ── Buyer stamps paid_at (no status change) ──
    mark_payment_sent: {
        actor: "buyer",
        from: ["pending_payment"],
        to: "pending_payment",
        wrongPartyReason: "Only the buyer can mark payment as sent.",
        wrongStatusReason: () => "This transaction is not awaiting payment.",
    },

    // ── Seller verifies funds, parks the horse, releases the PIN.
    //    Additionally requires paid_at (checked via requirePaidAt). ──
    verify_funds: {
        actor: "seller",
        from: ["pending_payment"],
        to: "funds_verified",
        wrongPartyReason: "Only the seller can verify funds.",
        wrongStatusReason: () => "This transaction is not awaiting verification.",
    },

    // ── Seller bails out anywhere before completion ──
    cancel_transaction: {
        actor: "seller",
        from: ["offer_made", "pending_payment", "funds_verified"],
        to: "cancelled",
        wrongPartyReason: "Only the seller can cancel.",
        wrongStatusReason: (s) => `Transaction cannot be cancelled in "${s}" state.`,
    },

    // ── Either party finalizes. TIGHTENED: completeTransaction had no
    //    party or status guard at all before this module (any authed
    //    caller, any status — including cancelled). Legal sources are
    //    the two statuses the rest of the system completes from:
    //    'pending' (legacy conversation flow) and 'funds_verified'
    //    (Safe-Trade claim flow). ──
    complete_transaction: {
        actor: "either",
        from: ["pending", "funds_verified"],
        to: "completed",
        wrongPartyReason: "Only a party to this transaction can complete it.",
        wrongStatusReason: (s) => `Transaction cannot be completed from "${s}" state.`,
    },

    // ── System closes the loop when the buyer claims the parked horse ──
    claim_completion: {
        actor: "system",
        from: ["funds_verified"],
        to: "completed",
        wrongPartyReason: "Only the system can complete a claim.",
        wrongStatusReason: (s) => `Claim cannot complete a "${s}" transaction.`,
    },

    // ── Cron auto-cancels offers older than 7 days ──
    auto_cancel_stale_offer: {
        actor: "system",
        from: ["offer_made"],
        to: "cancelled",
        wrongPartyReason: "Only the system can auto-cancel offers.",
        wrongStatusReason: (s) => `Auto-cancel only applies to pending offers, not "${s}".`,
    },
};

/** The transaction fields the state machine needs to authorize an action. */
export interface TransactionContext {
    status: TransactionStatus;
    /** party_a_id — the seller. */
    partyAId: string;
    /** party_b_id — the buyer (nullable on legacy rows). */
    partyBId: string | null;
}

/** Which side of the transaction the caller is on, if any. */
export function actorForCaller(
    callerId: string,
    txn: Pick<TransactionContext, "partyAId" | "partyBId">,
): "seller" | "buyer" | null {
    if (callerId === txn.partyAId) return "seller";
    if (txn.partyBId !== null && callerId === txn.partyBId) return "buyer";
    return null;
}

/**
 * Can `callerId` perform `action` on a transaction in this state?
 * Party is checked before status — matching the order (and therefore
 * the error precedence) of the original inline checks.
 */
export function canPerform(
    action: CommerceAction,
    callerId: string,
    txn: TransactionContext,
): TransitionResult {
    const spec = COMMERCE_ACTIONS[action];

    if (spec.actor === "system") {
        return { ok: false, reason: spec.wrongPartyReason };
    }

    const role = actorForCaller(callerId, txn);
    const partyOk =
        spec.actor === "either" ? role !== null : role === spec.actor;
    if (!partyOk) {
        return { ok: false, reason: spec.wrongPartyReason };
    }

    if (!spec.from.includes(txn.status)) {
        return { ok: false, reason: spec.wrongStatusReason(txn.status) };
    }

    return { ok: true };
}

/**
 * verify_funds precondition beyond the status graph: the buyer must
 * have stamped paid_at first. Kept here so the whole gate is testable
 * without I/O. Reason string is the original action's exact message.
 */
export function requirePaidAt(paidAt: string | null): TransitionResult {
    if (!paidAt) {
        return { ok: false, reason: "Buyer has not yet marked payment as sent." };
    }
    return { ok: true };
}

/** All actions legal from `status` (ignoring party) — for tests/UI parity. */
export function legalActions(status: TransactionStatus): CommerceAction[] {
    return (Object.keys(COMMERCE_ACTIONS) as CommerceAction[]).filter((a) =>
        COMMERCE_ACTIONS[a].from.includes(status),
    );
}
