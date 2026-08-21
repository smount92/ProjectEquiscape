/**
 * THE MIXED TRANSCRIPT — chat and events in one chronological stream.
 * Pure, no I/O.
 *
 * The structural bug this closes, in the plan's words: the offer lives
 * ABOVE the conversation, not IN it. You can accept a $300 offer and the
 * transcript still reads "hi" / "hi". There is no record inside the
 * thread of what was offered, when it was accepted, what was agreed about
 * shipping, or when payment was claimed.
 *
 * So every state change writes a permanent, non-editable entry into
 * `messages` with a `kind` and a `payload`, and the thread renders chat
 * bubbles and ledger leaves in one stream. This module owns the kinds,
 * the payload shapes, and the pure function that turns a stored row into
 * the sentence a human reads. No JSX: the same descriptors drive the
 * thread, the inbox preview, and the printed evidence pack, and all three
 * must say the same thing.
 *
 * Event entries are written by the server on the caller's behalf and are
 * never editable — migration 173's WITH CHECK clauses hold that at the
 * database, not just here.
 */

import { formatDate, formatMoney, formatStamp } from "./terms";

// ── Kinds ─────────────────────────────────────────────────────────────

/**
 * Every existing row is `chat` — the backfill in migration 173 sets that
 * default, which is why 'chat' rather than 'text': the owner's note was
 * that everything in DMs right now has been conversational, and the name
 * should say so.
 */
export const MESSAGE_KINDS = [
    "chat",
    "photo",
    "offer",
    "counter_offer",
    "offer_response",
    "terms_proposed",
    "terms_agreed",
    "plan_created",
    "payment_sent",
    "payment_confirmed",
    "handover",
    "dispute",
    "completed",
    "system",
] as const;

export type MessageKind = (typeof MESSAGE_KINDS)[number];

/** Kinds a person types. Everything else is written by a state change. */
export const CONVERSATIONAL_KINDS: readonly MessageKind[] = ["chat", "photo"];

export function isEventKind(kind: MessageKind): boolean {
    return !CONVERSATIONAL_KINDS.includes(kind);
}

export function coerceKind(raw: unknown): MessageKind {
    return typeof raw === "string" && (MESSAGE_KINDS as readonly string[]).includes(raw)
        ? (raw as MessageKind)
        : "chat";
}

// ── Payloads ──────────────────────────────────────────────────────────

export interface OfferPayload {
    amount: number | null;
    note?: string | null;
    /** Set on a counter — what it is countering. */
    previousAmount?: number | null;
    transactionId?: string | null;
}

export interface OfferResponsePayload {
    action: "accept" | "decline" | "retract" | "expire" | "cancel";
    amount: number | null;
    reason?: string | null;
}

export interface TermsPayload {
    revision: number;
    /** Titles of the boxes as they stood, so the entry stays readable
     *  even if the terms are later superseded. */
    boxTitles: string[];
    agreedPrice?: number | null;
}

export interface PlanPayload {
    installmentCount: number;
    total: number | null;
    firstDueDate?: string | null;
    lastDueDate?: string | null;
}

export interface PaymentPayload {
    seq: number;
    amount: number | null;
    /** The date the party stated, which may not be the date they clicked. */
    onDate?: string | null;
    note?: string | null;
    remaining?: number | null;
}

export interface HandoverPayload {
    /** "pin_issued" | "claimed" | "shipped" — what physically happened. */
    step: string;
    detail?: string | null;
}

export interface DisputePayload {
    reason?: string | null;
    /** Set when the dispute is stood down. */
    resolved?: boolean;
}

export interface CompletedPayload {
    amount: number | null;
    kind?: string | null;
}

export type EventPayload =
    | OfferPayload
    | OfferResponsePayload
    | TermsPayload
    | PlanPayload
    | PaymentPayload
    | HandoverPayload
    | DisputePayload
    | CompletedPayload
    | Record<string, unknown>;

/** jsonb → object, tolerating null and a stringified column. */
export function coercePayload(raw: unknown): Record<string, unknown> {
    if (!raw) return {};
    if (typeof raw === "object" && !Array.isArray(raw)) return raw as Record<string, unknown>;
    if (typeof raw === "string") {
        try {
            const parsed = JSON.parse(raw);
            return parsed && typeof parsed === "object" && !Array.isArray(parsed)
                ? (parsed as Record<string, unknown>)
                : {};
        } catch {
            return {};
        }
    }
    return {};
}

// ── Descriptors ───────────────────────────────────────────────────────

export interface EventDescriptor {
    /** A glyph, matching the site's existing emoji-forward event voice. */
    icon: string;
    /** One sentence, past tense, naming who did it. */
    headline: string;
    /** Supporting label/value lines. May be empty. */
    lines: { label: string; value: string }[];
    /**
     * Tone, for the leaf's accent. `note` is neutral; `money` marks a
     * ledger movement; `warn` is reserved for disputes and closures —
     * never for an overdue payment, which is a fact, not a verdict.
     */
    tone: "note" | "money" | "good" | "warn";
}

export interface DescribeContext {
    /** Display name of whoever wrote the entry ("you" resolved by caller). */
    actorName: string;
    /** Label of the other side, for sentences that name both. */
    otherName?: string;
}

const num = (v: unknown): number | null => {
    const n = typeof v === "number" ? v : Number(v);
    return Number.isFinite(n) ? n : null;
};
const text = (v: unknown): string | null =>
    typeof v === "string" && v.trim() ? v.trim() : null;

/**
 * Turn a stored event row into the sentence the thread, the inbox
 * preview and the evidence pack all show. Unknown kinds and malformed
 * payloads fall back to a neutral note rather than throwing — a
 * transcript that refuses to render is worse than one that renders a
 * vague line.
 */
export function describeEvent(
    kind: MessageKind,
    rawPayload: unknown,
    ctx: DescribeContext,
    /** The message's own `content`, used as the fallback sentence. */
    content?: string | null,
): EventDescriptor {
    const p = coercePayload(rawPayload);
    const who = ctx.actorName;

    switch (kind) {
        case "offer": {
            const amount = num(p.amount);
            const note = text(p.note);
            return {
                icon: "💰",
                tone: "money",
                headline: `${who} offered ${formatMoney(amount)}`,
                lines: note ? [{ label: "Message", value: note }] : [],
            };
        }
        case "counter_offer": {
            const amount = num(p.amount);
            const prev = num(p.previousAmount);
            const note = text(p.note);
            return {
                icon: "↔️",
                tone: "money",
                headline: `${who} countered at ${formatMoney(amount)}`,
                lines: [
                    ...(prev !== null ? [{ label: "Countering", value: formatMoney(prev) }] : []),
                    ...(note ? [{ label: "Message", value: note }] : []),
                ],
            };
        }
        case "offer_response": {
            const action = text(p.action) ?? "";
            const amount = num(p.amount);
            const reason = text(p.reason);
            const map: Record<string, { icon: string; verb: string; tone: EventDescriptor["tone"] }> = {
                accept: { icon: "🤝", verb: "accepted", tone: "good" },
                decline: { icon: "🚫", verb: "declined", tone: "warn" },
                retract: { icon: "↩️", verb: "retracted", tone: "note" },
                cancel: { icon: "🚫", verb: "cancelled", tone: "warn" },
                expire: { icon: "⏳", verb: "let expire", tone: "note" },
            };
            const m = map[action] ?? { icon: "•", verb: "responded to", tone: "note" as const };
            const subject = amount !== null ? ` the ${formatMoney(amount)} offer` : " the offer";
            return {
                icon: m.icon,
                tone: m.tone,
                headline: `${who} ${m.verb}${subject}`,
                lines: reason ? [{ label: "Reason", value: reason }] : [],
            };
        }
        case "terms_proposed": {
            const titles = Array.isArray(p.boxTitles) ? (p.boxTitles as unknown[]).map(String) : [];
            const rev = num(p.revision);
            return {
                icon: "📋",
                tone: "note",
                headline: `${who} wrote the terms`,
                lines: [
                    ...(titles.length ? [{ label: "Boxes", value: titles.join(" · ") }] : []),
                    ...(rev !== null ? [{ label: "Revision", value: String(rev) }] : []),
                ],
            };
        }
        case "terms_agreed": {
            const price = num(p.agreedPrice);
            return {
                icon: "✍️",
                tone: "good",
                headline: `${who} agreed to the terms`,
                lines: price !== null ? [{ label: "Agreed price", value: formatMoney(price) }] : [],
            };
        }
        case "plan_created": {
            const count = num(p.installmentCount);
            const total = num(p.total);
            const first = text(p.firstDueDate);
            const last = text(p.lastDueDate);
            return {
                icon: "🗓️",
                tone: "money",
                headline: `Payment plan set — ${count ?? "?"} payments totalling ${formatMoney(total)}`,
                lines: [
                    ...(first ? [{ label: "First due", value: formatDate(first) }] : []),
                    ...(last ? [{ label: "Last due", value: formatDate(last) }] : []),
                ],
            };
        }
        case "payment_sent": {
            const seq = num(p.seq);
            const amount = num(p.amount);
            const onDate = text(p.onDate);
            const note = text(p.note);
            return {
                icon: "📤",
                tone: "money",
                headline: `${who} marked payment ${seq ?? "?"} sent — ${formatMoney(amount)}`,
                lines: [
                    ...(onDate ? [{ label: "Sent on", value: formatDate(onDate) }] : []),
                    ...(note ? [{ label: "Note", value: note }] : []),
                ],
            };
        }
        case "payment_confirmed": {
            const seq = num(p.seq);
            const amount = num(p.amount);
            const onDate = text(p.onDate);
            const remaining = num(p.remaining);
            return {
                icon: "📥",
                tone: "good",
                headline: `${who} confirmed payment ${seq ?? "?"} received — ${formatMoney(amount)}`,
                lines: [
                    ...(onDate ? [{ label: "Received on", value: formatDate(onDate) }] : []),
                    ...(remaining !== null
                        ? [{ label: "Still outstanding", value: formatMoney(remaining) }]
                        : []),
                ],
            };
        }
        case "handover": {
            const step = text(p.step) ?? "";
            const detail = text(p.detail);
            const map: Record<string, string> = {
                pin_issued: "Claim PIN released to the buyer",
                claimed: "The horse was claimed",
                shipped: "Marked as shipped",
                received: "Marked as received",
            };
            return {
                icon: "📦",
                tone: "note",
                headline: map[step] ?? `${who} updated the handover`,
                lines: detail ? [{ label: "Detail", value: detail }] : [],
            };
        }
        case "dispute": {
            const reason = text(p.reason);
            const resolved = p.resolved === true;
            return {
                icon: resolved ? "🕊️" : "⚠️",
                tone: resolved ? "note" : "warn",
                headline: resolved
                    ? `${who} stood the dispute down`
                    : `${who} raised a dispute — this record is now frozen`,
                lines: reason ? [{ label: "Stated reason", value: reason }] : [],
            };
        }
        case "completed": {
            const amount = num(p.amount);
            return {
                icon: "🏁",
                tone: "good",
                headline: `Deal settled${amount !== null ? ` at ${formatMoney(amount)}` : ""}`,
                lines: [],
            };
        }
        case "system":
            return {
                icon: "•",
                tone: "note",
                headline: text(content) ?? "Recorded",
                lines: [],
            };
        default:
            return {
                icon: "•",
                tone: "note",
                headline: text(content) ?? "Recorded",
                lines: [],
            };
    }
}

/**
 * The plain-text sentence for an entry, used by the inbox preview and by
 * the printed transcript. Built from the same descriptor so an event can
 * never read one way in the thread and another on the record.
 */
export function eventSummaryLine(
    kind: MessageKind,
    payload: unknown,
    ctx: DescribeContext,
    content?: string | null,
): string {
    if (!isEventKind(kind)) return content?.trim() || "";
    return describeEvent(kind, payload, ctx, content).headline;
}

/** A one-line preview for the inbox list, whatever the kind. */
export function previewLine(
    kind: MessageKind,
    payload: unknown,
    content: string | null,
    ctx: DescribeContext,
    maxLength = 90,
): string {
    const raw = isEventKind(kind)
        ? eventSummaryLine(kind, payload, ctx, content)
        : kind === "photo" && !content?.trim()
          ? "Sent a photo"
          : (content ?? "");
    const t = raw.replace(/\s+/g, " ").trim();
    return t.length > maxLength ? `${t.slice(0, maxLength - 1)}…` : t;
}

/**
 * The full stamped line for the evidence pack: an event with its exact
 * time, formatted so it can be read aloud to a payment processor.
 */
export function evidenceLine(
    kind: MessageKind,
    payload: unknown,
    ctx: DescribeContext,
    createdAt: string,
    content?: string | null,
): string {
    const d = describeEvent(kind, payload, ctx, content);
    const detail = d.lines
        .map((l) => (l.label ? `${l.label}: ${l.value}` : l.value))
        .join("; ");
    return `${formatStamp(createdAt)} — ${d.headline}${detail ? ` (${detail})` : ""}`;
}
