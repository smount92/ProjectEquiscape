/**
 * THE EVIDENCE PACK — we are the record, not the referee.
 * Pure, no I/O.
 *
 * The owner's ruling on what happens when a deal goes wrong: we don't
 * arbitrate, don't refund, don't judge who's right. We freeze, we
 * preserve, and — his words — we "USE our records to prove to payment
 * processors who did what."
 *
 * That last clause is a product specification. A PayPal or card dispute
 * is decided by whoever files the more legible narrative, and the losing
 * side is almost always the one whose evidence is forty screenshots of a
 * Facebook thread in no particular order. What a processor's reviewer
 * wants is short: who the parties were, what was agreed, what money moved
 * and when, who confirmed what, and the conversation that surrounds it —
 * each item stamped and in order.
 *
 * This module assembles exactly that from the deal's own rows. It states
 * nothing the parties did not state themselves and reaches no conclusion
 * about who is right; every line is either a stored fact or a stamped
 * quotation. The one editorial act is ordering.
 */

import {
    boxLines,
    formatMoney,
    formatStamp,
    isFullyAgreed,
    boxTitle,
    type DealTerms,
} from "./terms";
import {
    installmentState,
    installmentStateLabel,
    ledgerSummary,
    type Installment,
} from "./ledger";
import {
    describeEvent,
    isEventKind,
    type MessageKind,
} from "./transcript";
import { dealNoun, roleLabel, stageLabel, type DealKind, type DealStage } from "./vocabulary";

// ── Inputs ────────────────────────────────────────────────────────────

export interface EvidenceParty {
    userId: string;
    alias: string;
    /** ISO — how long they have been on the platform. */
    memberSince: string | null;
    /** Completed Hoofprint transfers, the platform's own trade count. */
    completedTransfers: number | null;
}

export interface EvidenceMessage {
    id: string;
    senderId: string | null;
    kind: MessageKind;
    payload: unknown;
    content: string | null;
    createdAt: string;
    attachmentCount?: number;
}

export interface EvidenceInput {
    conversationId: string;
    kind: DealKind;
    stage: DealStage;
    partyA: EvidenceParty;
    partyB: EvidenceParty;
    subject: {
        title: string;
        /** "Breyer — Salinero", the reference line. */
        reference?: string | null;
        horseId?: string | null;
        commissionId?: string | null;
    } | null;
    terms: DealTerms;
    installments: Installment[];
    messages: EvidenceMessage[];
    /** Safe-Trade timestamps, when the deal ran through one. */
    transaction: {
        id: string;
        status: string;
        offerAmount: number | null;
        createdAt: string | null;
        acceptedAt: string | null;
        paidAt: string | null;
        verifiedAt: string | null;
        completedAt: string | null;
    } | null;
    generatedAt: string;
    /** Who asked for the pack. Named on the cover — packs are attributable. */
    generatedForAlias: string;
}

// ── Output model ──────────────────────────────────────────────────────

export interface EvidenceRow {
    label: string;
    value: string;
}

export interface EvidenceSection {
    id: string;
    title: string;
    /** One-sentence explanation of what a reader is looking at. */
    note?: string;
    rows?: EvidenceRow[];
    /** Free lines — the transcript, the terms text boxes. */
    lines?: string[];
    /** Tabular ledger rows. */
    table?: { headers: string[]; rows: string[][] };
}

export interface EvidencePack {
    title: string;
    subtitle: string;
    /** The standing disclaimer. Printed on the cover, not buried. */
    disclaimer: string;
    sections: EvidenceSection[];
}

/**
 * The disclaimer is load-bearing, not boilerplate. A pack that reads as
 * a platform ADJUDICATION would invite exactly the referee role the
 * owner ruled out, and would be worth less to a processor, not more:
 * reviewers discount a marketplace's opinion and credit its logs.
 */
export const EVIDENCE_DISCLAIMER =
    "Model Horse Hub is a record-keeper, not a payment processor and not an arbitrator. " +
    "We never hold funds and take no position on who is right. Every entry below is either a " +
    "timestamped action taken by one of the two parties on this platform, or their own words, " +
    "reproduced without alteration.";

// ── Assembly ──────────────────────────────────────────────────────────

export function buildEvidencePack(input: EvidenceInput): EvidencePack {
    const labels = {
        a: roleLabel(input.kind, "a"),
        b: roleLabel(input.kind, "b"),
    };
    const nameFor = (userId: string | null): string => {
        if (userId && userId === input.partyA.userId) return `@${input.partyA.alias}`;
        if (userId && userId === input.partyB.userId) return `@${input.partyB.alias}`;
        return "Model Horse Hub";
    };

    const sections: EvidenceSection[] = [];

    // ── 1. The parties ────────────────────────────────────────────────
    sections.push({
        id: "parties",
        title: "The parties",
        rows: [
            { label: labels.a, value: partyLine(input.partyA) },
            { label: labels.b, value: partyLine(input.partyB) },
            { label: "Record id", value: input.conversationId },
        ],
    });

    // ── 2. The subject ────────────────────────────────────────────────
    if (input.subject) {
        const rows: EvidenceRow[] = [{ label: "Item", value: input.subject.title }];
        if (input.subject.reference) rows.push({ label: "Reference", value: input.subject.reference });
        if (input.subject.horseId) rows.push({ label: "Horse record", value: input.subject.horseId });
        if (input.subject.commissionId) {
            rows.push({ label: "Commission record", value: input.subject.commissionId });
        }
        sections.push({
            id: "subject",
            title: `What the ${dealNoun(input.kind)} was for`,
            rows,
        });
    }

    // ── 3. The agreement ──────────────────────────────────────────────
    const termsSection: EvidenceSection = {
        id: "terms",
        title: "What was agreed",
        note: isFullyAgreed(input.terms)
            ? `Both parties confirmed these terms. Neither could edit them afterwards; revision ${input.terms.revision} is what they agreed to.`
            : "These terms were written but NOT confirmed by both parties. They are reproduced as evidence of what was proposed.",
        rows: [],
        lines: [],
    };
    for (const box of input.terms.boxes) {
        const lines = boxLines(box, labels);
        if (lines.length === 0) continue;
        termsSection.rows!.push({ label: boxTitle(box), value: "" });
        for (const line of lines) {
            termsSection.rows!.push({
                label: line.label ? `    ${line.label}` : "    ",
                value: line.value,
            });
        }
    }
    termsSection.rows!.push({
        label: `Confirmed by ${labels.a}`,
        value: input.terms.agreedByAAt ? formatStamp(input.terms.agreedByAAt) : "Not confirmed",
    });
    termsSection.rows!.push({
        label: `Confirmed by ${labels.b}`,
        value: input.terms.agreedByBAt ? formatStamp(input.terms.agreedByBAt) : "Not confirmed",
    });
    if (termsSection.rows!.length > 2) sections.push(termsSection);

    // ── 4. The payment ledger ─────────────────────────────────────────
    if (input.installments.length > 0) {
        const summary = ledgerSummary(input.installments, new Date(input.generatedAt));
        sections.push({
            id: "ledger",
            title: "Payment ledger",
            note:
                "Each row carries two independent statements with dates: the paying party's " +
                "declaration that money was sent, and the receiving party's confirmation that it " +
                "arrived. Model Horse Hub did not handle any of this money.",
            table: {
                headers: ["#", "Amount", "Due", "Marked sent", "Confirmed received", "State"],
                rows: input.installments.map((row) => [
                    String(row.seq),
                    formatMoney(row.amount),
                    row.dueDate ? formatStamp(row.dueDate) : "—",
                    row.markedSentAt ? formatStamp(row.markedSentAt) : "—",
                    row.confirmedAt ? formatStamp(row.confirmedAt) : "—",
                    installmentStateLabel(
                        installmentState(row, new Date(input.generatedAt)),
                    ),
                ]),
            },
            rows: [
                { label: "Plan total", value: formatMoney(summary.total) },
                { label: "Confirmed received", value: formatMoney(summary.confirmedTotal) },
                { label: "Marked sent, unconfirmed", value: formatMoney(summary.sentTotal - summary.confirmedTotal) },
                { label: "Outstanding on this record", value: formatMoney(summary.remaining) },
            ],
        });
    }

    // ── 5. The Safe-Trade steps ───────────────────────────────────────
    if (input.transaction) {
        const t = input.transaction;
        const rows: EvidenceRow[] = [
            { label: "Transaction id", value: t.id },
            { label: "Current state", value: stageLabel(input.stage) },
        ];
        if (t.offerAmount !== null) rows.push({ label: "Offer amount", value: formatMoney(t.offerAmount) });
        if (t.createdAt) rows.push({ label: "Offer made", value: formatStamp(t.createdAt) });
        if (t.acceptedAt) rows.push({ label: "Offer accepted", value: formatStamp(t.acceptedAt) });
        if (t.paidAt) rows.push({ label: `${labels.b} declared payment sent`, value: formatStamp(t.paidAt) });
        if (t.verifiedAt) {
            rows.push({ label: `${labels.a} confirmed funds received`, value: formatStamp(t.verifiedAt) });
        }
        if (t.completedAt) rows.push({ label: "Completed", value: formatStamp(t.completedAt) });
        sections.push({
            id: "safe-trade",
            title: "Platform-recorded steps",
            note:
                "These timestamps were written by the platform when each party took the " +
                "corresponding action. They are not editable by either party.",
            rows,
        });
    }

    // ── 6. The event log ──────────────────────────────────────────────
    const events = input.messages.filter((m) => isEventKind(m.kind));
    if (events.length > 0) {
        sections.push({
            id: "events",
            title: "Everything that happened, in order",
            note: "Structured entries written by the platform as each action was taken.",
            lines: events.map((m) => {
                const d = describeEvent(m.kind, m.payload, { actorName: nameFor(m.senderId) }, m.content);
                const detail = d.lines
                    .map((l) => (l.label ? `${l.label}: ${l.value}` : l.value))
                    .join("; ");
                return `${formatStamp(m.createdAt)} — ${d.headline}${detail ? ` (${detail})` : ""}`;
            }),
        });
    }

    // ── 7. The conversation ───────────────────────────────────────────
    const chat = input.messages.filter((m) => !isEventKind(m.kind));
    sections.push({
        id: "transcript",
        title: "The conversation",
        note:
            chat.length > 0
                ? "Reproduced in full and unaltered. Photographs sent in the thread are noted but not printed."
                : "No messages were exchanged in this thread.",
        lines: chat.map((m) => {
            const body = (m.content ?? "").trim() || "(no text)";
            const photos = m.attachmentCount
                ? ` [${m.attachmentCount} photo${m.attachmentCount === 1 ? "" : "s"} attached]`
                : "";
            return `${formatStamp(m.createdAt)} — ${nameFor(m.senderId)}: ${body}${photos}`;
        }),
    });

    const subjectTitle = input.subject?.title ? ` — ${input.subject.title}` : "";
    return {
        title: `Deal record${subjectTitle}`,
        subtitle:
            `${capitalize(dealNoun(input.kind))} between @${input.partyA.alias} (${labels.a}) and ` +
            `@${input.partyB.alias} (${labels.b}) · prepared for @${input.generatedForAlias} on ` +
            `${formatStamp(input.generatedAt)}`,
        disclaimer: EVIDENCE_DISCLAIMER,
        sections,
    };
}

function partyLine(p: EvidenceParty): string {
    const bits = [`@${p.alias}`];
    if (p.memberSince) {
        bits.push(
            `member since ${new Date(p.memberSince).toLocaleDateString("en-US", {
                month: "long",
                year: "numeric",
                timeZone: "UTC",
            })}`,
        );
    }
    if (typeof p.completedTransfers === "number") {
        bits.push(
            `${p.completedTransfers} completed transfer${p.completedTransfers === 1 ? "" : "s"} on record`,
        );
    }
    return bits.join(" · ");
}

function capitalize(s: string): string {
    return s.length ? s[0].toUpperCase() + s.slice(1) : s;
}

/**
 * The pack as plain text, for copy-paste into a dispute form that only
 * takes typing. Deliberately provided: processors' web forms routinely
 * cap you at a textarea, and a PDF you cannot attach is worth nothing.
 */
export function evidencePackToText(pack: EvidencePack): string {
    const out: string[] = [pack.title, pack.subtitle, "", pack.disclaimer, ""];
    for (const section of pack.sections) {
        out.push("", `== ${section.title.toUpperCase()} ==`);
        if (section.note) out.push(section.note);
        if (section.rows) {
            for (const row of section.rows) {
                out.push(row.value ? `${row.label}: ${row.value}` : `${row.label}`);
            }
        }
        if (section.table) {
            out.push(section.table.headers.join(" | "));
            for (const row of section.table.rows) out.push(row.join(" | "));
        }
        if (section.lines) {
            for (const line of section.lines) out.push(line);
        }
    }
    return out.join("\n");
}
