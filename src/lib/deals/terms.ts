/**
 * THE CONTRACT BOXES — "a set of boxes both users agree to".
 * Pure, no I/O.
 *
 * The owner's framing, verbatim: the deal thread is a structured
 * contract — the rules/terms, payment plans, sent-payment and
 * received-payment confirmations with dates, offer and agreed price
 * boxes, "as many as necessary — could be very specific with these."
 *
 * So terms are not a fixed record with a fixed set of columns. They are
 * an ORDERED LIST of typed boxes, stored as jsonb on the conversation,
 * and the list is open: adding a new box type later is a change to this
 * file and nothing else. Every reader coerces through `coerceTerms`,
 * which never throws and drops what it doesn't recognise, so an old
 * client meeting a newer box degrades to ignoring it rather than
 * exploding.
 *
 * THE ONE RULE THAT MATTERS: we never author terms. There is no
 * DEFAULT_TERMS export here — deliberately, and in contrast to
 * src/lib/studio/terms.ts, where the artist's studio-wide policy has
 * researched defaults because it is a POLICY. A deal's terms are two
 * people's own words about one specific horse. `blankBox` hands them an
 * empty shape to fill; it does not fill it.
 *
 * The confirmation model:
 *   - either party may edit the boxes at any time before both agree;
 *   - any edit clears BOTH confirmations (you cannot agree to something
 *     that changed after you agreed to it);
 *   - once both have confirmed, the terms are settled and further edits
 *     are refused by `applyEdit` and, on a pasted database, by the
 *     freeze trigger in migration 173.
 */

// ── Box types ─────────────────────────────────────────────────────────

export const TERM_BOX_TYPES = [
    "price",
    "payment_plan",
    "shipping",
    "rules",
    "deadline",
    "items",
    "custom",
] as const;

export type TermBoxType = (typeof TERM_BOX_TYPES)[number];

interface BoxBase {
    /** Stable id so a confirmation can name the exact box it agreed to. */
    id: string;
    type: TermBoxType;
    /** The parties may rename any box. Falls back to the type's own name. */
    label?: string | null;
}

/** The agreed price. Flows into the buyer's vault on completion. */
export interface PriceBox extends BoxBase {
    type: "price";
    amount: number | null;
    currency: "USD";
    /** "PayPal Goods & Services", "USPS money order" — their words. */
    method?: string | null;
}

/**
 * A payment plan's SHAPE. The rows themselves live in the
 * payment_installments table so each one can be marked and confirmed
 * with its own dates; this box is what the parties agreed the plan
 * would be, frozen alongside the rest of the terms.
 */
export interface PaymentPlanBox extends BoxBase {
    type: "payment_plan";
    installmentCount: number | null;
    /** What happens on a missed payment — THEIR words, never ours. */
    missedPaymentTerms?: string | null;
}

export interface ShippingBox extends BoxBase {
    type: "shipping";
    method?: string | null;
    cost: number | null;
    /** Which party pays for shipping, in the A/B vocabulary. */
    paidBy?: "a" | "b" | "split" | null;
    insured?: boolean | null;
    /** ISO date (yyyy-mm-dd) the sender expects to ship by. */
    expectedShipDate?: string | null;
}

/** Free text. The parties' own rules, in their own words. */
export interface RulesBox extends BoxBase {
    type: "rules";
    text: string;
}

export interface DeadlineBox extends BoxBase {
    type: "deadline";
    /** ISO date (yyyy-mm-dd). */
    date: string | null;
    note?: string | null;
}

/** What changes hands. Used by trades and by bundle sales. */
export interface ItemsBox extends BoxBase {
    type: "items";
    /** Items party A hands over. Free text lines or horse names. */
    fromA: string[];
    /** Items party B hands over. */
    fromB: string[];
}

/** Anything the closed set can't carry. "As many as necessary." */
export interface CustomBox extends BoxBase {
    type: "custom";
    text: string;
}

export type TermBox =
    | PriceBox
    | PaymentPlanBox
    | ShippingBox
    | RulesBox
    | DeadlineBox
    | ItemsBox
    | CustomBox;

const TYPE_NAMES: Record<TermBoxType, string> = {
    price: "Agreed price",
    payment_plan: "Payment plan",
    shipping: "Shipping",
    rules: "Terms & rules",
    deadline: "Deadline",
    items: "What changes hands",
    custom: "Also agreed",
};

export function boxTitle(box: TermBox): string {
    const label = typeof box.label === "string" ? box.label.trim() : "";
    return label || TYPE_NAMES[box.type];
}

// ── The terms document ────────────────────────────────────────────────

export interface DealTerms {
    boxes: TermBox[];
    /** ISO timestamp party A confirmed the current boxes, or null. */
    agreedByAAt: string | null;
    /** ISO timestamp party B confirmed the current boxes, or null. */
    agreedByBAt: string | null;
    /** Bumped on every edit. The confirmations name a revision. */
    revision: number;
    updatedAt: string | null;
    /** Party who last edited — "a" | "b", or null on a fresh document. */
    updatedBy: "a" | "b" | null;
}

export const EMPTY_TERMS: DealTerms = {
    boxes: [],
    agreedByAAt: null,
    agreedByBAt: null,
    revision: 0,
    updatedAt: null,
    updatedBy: null,
};

export function emptyTerms(): DealTerms {
    return { ...EMPTY_TERMS, boxes: [] };
}

/** Both sides have confirmed the current revision. */
export function isFullyAgreed(terms: DealTerms): boolean {
    return terms.agreedByAAt !== null && terms.agreedByBAt !== null;
}

/** One side has confirmed and is waiting on the other. */
export function awaitingAgreementFrom(terms: DealTerms): "a" | "b" | null {
    if (isFullyAgreed(terms)) return null;
    if (terms.agreedByAAt && !terms.agreedByBAt) return "b";
    if (terms.agreedByBAt && !terms.agreedByAAt) return "a";
    return null;
}

/** The agreed price, if a price box carries one. Feeds the vault. */
export function agreedPrice(terms: DealTerms): number | null {
    for (const box of terms.boxes) {
        if (box.type === "price" && typeof box.amount === "number" && box.amount > 0) {
            return box.amount;
        }
    }
    return null;
}

/** The plan box, if the parties wrote one. */
export function paymentPlanBox(terms: DealTerms): PaymentPlanBox | null {
    for (const box of terms.boxes) {
        if (box.type === "payment_plan") return box;
    }
    return null;
}

// ── Coercion ──────────────────────────────────────────────────────────

const MAX_BOXES = 40;
const MAX_TEXT = 4000;
const MAX_ITEMS = 40;

function str(v: unknown, max = MAX_TEXT): string | null {
    if (typeof v !== "string") return null;
    const t = v.trim();
    if (!t) return null;
    return t.length > max ? t.slice(0, max) : t;
}

function money(v: unknown): number | null {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n) || n < 0) return null;
    return Math.round(n * 100) / 100;
}

function count(v: unknown): number | null {
    const n = typeof v === "number" ? v : Number(v);
    if (!Number.isFinite(n) || n < 1) return null;
    return Math.min(120, Math.round(n));
}

/** yyyy-mm-dd, or null. Rejects anything Date can't parse. */
export function isoDateOrNull(v: unknown): string | null {
    const s = str(v, 40);
    if (!s) return null;
    const m = /^(\d{4})-(\d{2})-(\d{2})/.exec(s);
    if (!m) return null;
    const d = new Date(`${m[1]}-${m[2]}-${m[3]}T00:00:00Z`);
    if (Number.isNaN(d.getTime())) return null;
    return `${m[1]}-${m[2]}-${m[3]}`;
}

function bool(v: unknown): boolean | null {
    if (typeof v === "boolean") return v;
    return null;
}

function lines(v: unknown): string[] {
    if (!Array.isArray(v)) return [];
    const out: string[] = [];
    for (const item of v) {
        const s = str(item, 200);
        if (s) out.push(s);
        if (out.length >= MAX_ITEMS) break;
    }
    return out;
}

let boxCounter = 0;

/** A collision-resistant id without pulling in a uuid dependency. */
export function newBoxId(): string {
    boxCounter = (boxCounter + 1) % 100000;
    return `box_${Date.now().toString(36)}_${boxCounter.toString(36)}_${Math.random()
        .toString(36)
        .slice(2, 8)}`;
}

/**
 * Coerce one raw object into a box, or null if it is unrecognisable.
 * Unknown types are dropped rather than guessed at — a newer client's
 * box type must not be silently rewritten into something else by an
 * older one.
 */
export function coerceBox(raw: unknown): TermBox | null {
    if (!raw || typeof raw !== "object") return null;
    const r = raw as Record<string, unknown>;
    const type = r.type;
    if (typeof type !== "string") return null;
    if (!(TERM_BOX_TYPES as readonly string[]).includes(type)) return null;

    const id = str(r.id, 80) ?? newBoxId();
    const label = str(r.label, 120);
    const base = { id, label } as const;

    switch (type as TermBoxType) {
        case "price":
            return { ...base, type: "price", amount: money(r.amount), currency: "USD", method: str(r.method, 200) };
        case "payment_plan":
            return {
                ...base,
                type: "payment_plan",
                installmentCount: count(r.installmentCount ?? r.installment_count),
                missedPaymentTerms: str(r.missedPaymentTerms ?? r.missed_payment_terms),
            };
        case "shipping": {
            const paidByRaw = r.paidBy ?? r.paid_by;
            const paidBy =
                paidByRaw === "a" || paidByRaw === "b" || paidByRaw === "split" ? paidByRaw : null;
            return {
                ...base,
                type: "shipping",
                method: str(r.method, 200),
                cost: money(r.cost),
                paidBy,
                insured: bool(r.insured),
                expectedShipDate: isoDateOrNull(r.expectedShipDate ?? r.expected_ship_date),
            };
        }
        case "rules":
            return { ...base, type: "rules", text: str(r.text) ?? "" };
        case "deadline":
            return { ...base, type: "deadline", date: isoDateOrNull(r.date), note: str(r.note, 400) };
        case "items":
            return { ...base, type: "items", fromA: lines(r.fromA ?? r.from_a), fromB: lines(r.fromB ?? r.from_b) };
        case "custom":
            return { ...base, type: "custom", text: str(r.text) ?? "" };
    }
    return null;
}

/**
 * Coerce anything — a jsonb column, a form payload, null on a database
 * where migration 173 has not been pasted — into a complete DealTerms.
 * Never throws. This is the feature-detection seam: before 173 the
 * column is absent, every read yields EMPTY_TERMS, and the deal room
 * renders its terms panel as "not set up yet" rather than 500ing.
 */
export function coerceTerms(raw: unknown): DealTerms {
    if (!raw || typeof raw !== "object") return emptyTerms();
    const r = raw as Record<string, unknown>;

    const rawBoxes = Array.isArray(r.boxes) ? r.boxes : [];
    const boxes: TermBox[] = [];
    const seen = new Set<string>();
    for (const item of rawBoxes) {
        const box = coerceBox(item);
        if (!box) continue;
        // Duplicate ids would make a confirmation ambiguous.
        if (seen.has(box.id)) box.id = newBoxId();
        seen.add(box.id);
        boxes.push(box);
        if (boxes.length >= MAX_BOXES) break;
    }

    const revRaw = r.revision;
    const revision =
        typeof revRaw === "number" && Number.isFinite(revRaw) && revRaw >= 0 ? Math.round(revRaw) : 0;

    const updatedBy = r.updatedBy ?? r.updated_by;

    return {
        boxes,
        agreedByAAt: str(r.agreedByAAt ?? r.agreed_by_a_at, 60),
        agreedByBAt: str(r.agreedByBAt ?? r.agreed_by_b_at, 60),
        revision,
        updatedAt: str(r.updatedAt ?? r.updated_at, 60),
        updatedBy: updatedBy === "a" || updatedBy === "b" ? updatedBy : null,
    };
}

// ── Blank shapes (NOT defaults) ───────────────────────────────────────

/**
 * An empty box of the given type, for the parties to fill in.
 *
 * Every field is empty on purpose. This function exists so the UI can
 * offer "add a shipping box" without the platform putting words in
 * anyone's mouth. If you are tempted to pre-fill something here, that is
 * the platform authoring terms, and the owner's ruling was explicit that
 * we do not.
 */
export function blankBox(type: TermBoxType, id: string = newBoxId()): TermBox {
    switch (type) {
        case "price":
            return { id, type: "price", amount: null, currency: "USD", method: null };
        case "payment_plan":
            return { id, type: "payment_plan", installmentCount: null, missedPaymentTerms: null };
        case "shipping":
            return {
                id,
                type: "shipping",
                method: null,
                cost: null,
                paidBy: null,
                insured: null,
                expectedShipDate: null,
            };
        case "rules":
            return { id, type: "rules", text: "" };
        case "deadline":
            return { id, type: "deadline", date: null, note: null };
        case "items":
            return { id, type: "items", fromA: [], fromB: [] };
        case "custom":
            return { id, type: "custom", text: "" };
    }
}

/** A box with nothing in it yet — the UI hides these from the record. */
export function isBoxEmpty(box: TermBox): boolean {
    switch (box.type) {
        case "price":
            return box.amount === null;
        case "payment_plan":
            return box.installmentCount === null && !box.missedPaymentTerms;
        case "shipping":
            return (
                !box.method &&
                box.cost === null &&
                !box.paidBy &&
                box.insured === null &&
                !box.expectedShipDate
            );
        case "rules":
        case "custom":
            return box.text.trim().length === 0;
        case "deadline":
            return box.date === null && !box.note;
        case "items":
            return box.fromA.length === 0 && box.fromB.length === 0;
    }
}

// ── Editing and agreeing ──────────────────────────────────────────────

export type TermsEditResult =
    | { ok: true; terms: DealTerms }
    | { ok: false; reason: string };

/**
 * Replace the boxes.
 *
 * Both confirmations are cleared: agreeing to revision 3 says nothing
 * about revision 4, and a contract where one side can edit after the
 * other has signed is not a contract. This is the single most important
 * function in the module.
 */
export function applyEdit(
    terms: DealTerms,
    boxes: TermBox[],
    by: "a" | "b",
    now: Date = new Date(),
): TermsEditResult {
    if (isFullyAgreed(terms)) {
        return {
            ok: false,
            reason: "These terms are agreed by both sides and can no longer be edited.",
        };
    }
    if (boxes.length > MAX_BOXES) {
        return { ok: false, reason: `A deal can hold at most ${MAX_BOXES} boxes.` };
    }
    // Round-trip through the coercer so an edit can never smuggle a
    // shape past the reader.
    const clean = coerceTerms({ boxes, revision: terms.revision }).boxes;
    return {
        ok: true,
        terms: {
            boxes: clean,
            agreedByAAt: null,
            agreedByBAt: null,
            revision: terms.revision + 1,
            updatedAt: now.toISOString(),
            updatedBy: by,
        },
    };
}

/** Confirm the current revision as one party. Idempotent. */
export function applyAgreement(
    terms: DealTerms,
    by: "a" | "b",
    now: Date = new Date(),
): TermsEditResult {
    if (terms.boxes.length === 0) {
        return { ok: false, reason: "There is nothing to agree to yet — add a box first." };
    }
    if (terms.boxes.every(isBoxEmpty)) {
        return { ok: false, reason: "Fill in at least one box before agreeing." };
    }
    const stamp = now.toISOString();
    return {
        ok: true,
        terms: {
            ...terms,
            agreedByAAt: by === "a" ? (terms.agreedByAAt ?? stamp) : terms.agreedByAAt,
            agreedByBAt: by === "b" ? (terms.agreedByBAt ?? stamp) : terms.agreedByBAt,
        },
    };
}

/** Withdraw your own confirmation, while the other side is still deciding. */
export function withdrawAgreement(
    terms: DealTerms,
    by: "a" | "b",
): TermsEditResult {
    if (isFullyAgreed(terms)) {
        return { ok: false, reason: "Both sides have agreed — these terms are settled." };
    }
    return {
        ok: true,
        terms: {
            ...terms,
            agreedByAAt: by === "a" ? null : terms.agreedByAAt,
            agreedByBAt: by === "b" ? null : terms.agreedByBAt,
        },
    };
}

// ── Rendering the record ──────────────────────────────────────────────

/**
 * Flatten a box into label/value lines for the evidence pack, the
 * printed record, and anywhere the terms are read rather than edited.
 * Money and dates are formatted here so every surface agrees.
 */
export function boxLines(
    box: TermBox,
    labels: { a: string; b: string } = { a: "Party A", b: "Party B" },
): { label: string; value: string }[] {
    const out: { label: string; value: string }[] = [];
    switch (box.type) {
        case "price":
            out.push({ label: "Amount", value: formatMoney(box.amount) });
            if (box.method) out.push({ label: "Paid by", value: box.method });
            break;
        case "payment_plan":
            out.push({
                label: "Installments",
                value: box.installmentCount ? `${box.installmentCount} payments` : "Not stated",
            });
            if (box.missedPaymentTerms) {
                out.push({ label: "If a payment is missed", value: box.missedPaymentTerms });
            }
            break;
        case "shipping":
            if (box.method) out.push({ label: "Method", value: box.method });
            if (box.cost !== null) out.push({ label: "Cost", value: formatMoney(box.cost) });
            if (box.paidBy) {
                out.push({
                    label: "Paid by",
                    value:
                        box.paidBy === "split"
                            ? "Split between both"
                            : box.paidBy === "a"
                              ? labels.a
                              : labels.b,
                });
            }
            if (box.insured !== null) {
                out.push({ label: "Insured", value: box.insured ? "Yes" : "No" });
            }
            if (box.expectedShipDate) {
                out.push({ label: "Expected to ship", value: formatDate(box.expectedShipDate) });
            }
            break;
        case "rules":
        case "custom":
            if (box.text.trim()) out.push({ label: "", value: box.text.trim() });
            break;
        case "deadline":
            if (box.date) out.push({ label: "Date", value: formatDate(box.date) });
            if (box.note) out.push({ label: "Note", value: box.note });
            break;
        case "items":
            if (box.fromA.length) out.push({ label: `From ${labels.a}`, value: box.fromA.join(", ") });
            if (box.fromB.length) out.push({ label: `From ${labels.b}`, value: box.fromB.join(", ") });
            break;
    }
    return out;
}

/** Whole dollars unless there are cents. Mirrors src/lib/studio/terms.ts. */
export function formatMoney(n: number | null | undefined): string {
    if (n == null || !Number.isFinite(n)) return "—";
    const hasCents = Math.round(n * 100) % 100 !== 0;
    return `$${n.toLocaleString("en-US", {
        minimumFractionDigits: hasCents ? 2 : 0,
        maximumFractionDigits: hasCents ? 2 : 0,
    })}`;
}

/** yyyy-mm-dd → "Sep 1, 2026". Dates render in UTC so both parties read the same day. */
export function formatDate(iso: string | null | undefined): string {
    if (!iso) return "—";
    const d = new Date(iso.length <= 10 ? `${iso}T00:00:00Z` : iso);
    if (Number.isNaN(d.getTime())) return "—";
    return d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
    });
}

/** Full stamp for the evidence pack — a date alone proves less. */
export function formatStamp(iso: string | null | undefined): string {
    if (!iso) return "—";
    const d = new Date(iso);
    if (Number.isNaN(d.getTime())) return "—";
    return `${d.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
        timeZone: "UTC",
    })} at ${d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        timeZone: "UTC",
    })} UTC`;
}
