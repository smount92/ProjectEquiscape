/**
 * Shows domain — MHH qualification card rules. Pure, no I/O.
 *
 * Cards are bearer tokens on the horse's Hoofprint:
 *  - Earned by 1st and 2nd in qualifying classes at shows marked
 *    is_mhh_qualifying (host opt-in, on by default).
 *  - The short code IS the card's id (URL-safe, 8 chars). This
 *    module generates candidates; the CALLER collision-checks
 *    against the database and regenerates on conflict.
 *  - Transfer with the horse via Safe-Trade (Phase F hook);
 *    redemption (future MHH Championship) verifies against
 *    show_placings and flips status.
 */

import type { CardStatus, Place } from "./types";
import type { TransitionResult } from "./stateMachine";

// ── Issuance ──

export const CARD_EARNING_PLACES: Place[] = [1, 2];

export interface CardIssuanceContext {
    place: Place | null;
    classIsQualifying: boolean;
    showIsMhhQualifying: boolean;
    entryStatus?: "entered" | "scratched" | "placed";
}

/** Should this placing issue an MHH qualification card? */
export function shouldIssueCard(ctx: CardIssuanceContext): boolean {
    if (!ctx.showIsMhhQualifying) return false;
    if (!ctx.classIsQualifying) return false;
    if (ctx.entryStatus === "scratched") return false;
    return ctx.place === 1 || ctx.place === 2;
}

// ── Short codes ──
// URL-safe, unambiguous alphabet: no 0/O, 1/I/l. Must match the
// CHECK constraint on qualification_cards.id (migration 117).

export const CARD_CODE_LENGTH = 8;
export const CARD_CODE_ALPHABET =
    "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghjkmnpqrstuvwxyz23456789";

const CARD_CODE_PATTERN = /^[A-HJ-NP-Za-km-z2-9]{8}$/;

/**
 * Generate a card short-code candidate. NOT guaranteed unique —
 * the call site must collision-check against qualification_cards
 * and call again on conflict.
 */
export function generateCardCode(
    random: () => number = Math.random,
): string {
    let code = "";
    for (let i = 0; i < CARD_CODE_LENGTH; i++) {
        const idx = Math.min(
            Math.floor(random() * CARD_CODE_ALPHABET.length),
            CARD_CODE_ALPHABET.length - 1,
        );
        code += CARD_CODE_ALPHABET[idx];
    }
    return code;
}

export function isValidCardCode(code: string): boolean {
    return CARD_CODE_PATTERN.test(code);
}

// ── Card status transitions ──
// issued → transferred (horse sold via Safe-Trade; repeatable)
// issued | transferred → redeemed (championship registrar check)
// issued | transferred → void (host/admin correction)
// redeemed and void are terminal.

export type CardAction = "transfer" | "redeem" | "void";

const CARD_ACTIONS: Record<CardAction, { from: CardStatus[]; to: CardStatus }> = {
    transfer: { from: ["issued", "transferred"], to: "transferred" },
    redeem: { from: ["issued", "transferred"], to: "redeemed" },
    void: { from: ["issued", "transferred"], to: "void" },
};

export function canApplyCardAction(
    status: CardStatus,
    action: CardAction,
): TransitionResult {
    const rule = CARD_ACTIONS[action];
    if (!rule) return { ok: false, reason: `Unknown card action: ${action}.` };
    if (!rule.from.includes(status)) {
        return {
            ok: false,
            reason:
                status === "redeemed"
                    ? "This card has already been redeemed."
                    : status === "void"
                        ? "This card has been voided."
                        : `A ${status} card cannot be ${action === "void" ? "voided" : `${action}ed`}.`,
        };
    }
    return { ok: true };
}

/** The resulting status after a legal action (validate with canApplyCardAction first). */
export function cardStatusAfter(action: CardAction): CardStatus {
    return CARD_ACTIONS[action].to;
}
