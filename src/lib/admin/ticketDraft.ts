/**
 * "Copy as ticket" (MHH-028). Problems and ideas arrive in several places
 * (the Mailbox, reports, Registry suggestions, barn threads); the board is
 * Backlog.md in the repo. This turns any of them into the one `backlog task
 * create` command the ticket skill uses, ready to paste into a terminal or
 * hand to Claude, so nothing is retyped and every ticket has the same shape.
 *
 * Never personal data (CLAUDE.md rule 10): emails and phone numbers in the
 * member's words are blanked, and the source names an alias at most.
 */

export type TicketType = "bug" | "feature" | "enhancement" | "chore" | "docs" | "spike";

export interface TicketDraft {
    /** A starting title; the owner rewrites it as "what will be true". */
    title: string;
    type: TicketType;
    labels: string[];
    priority?: "high" | "medium" | "low";
    /** The problem, in the member's words where there are any. */
    why: string;
    /** Where it came from: "Admin › Mailbox, @alias, 2026-10-15". */
    source: string;
    notes?: string;
    acceptance?: string[];
}

const EMAIL = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/g;
// A phone number's shape (optional country code, then 3-3-4 digits), so a
// date like 2026-10-15 or a model number is left alone.
const PHONE = /(?:\+\d{1,3}[\s.-]?)?\(?\b\d{3}\)?[\s.-]?\d{3}[\s.-]?\d{4}\b/g;

/** Blank emails and phone numbers, squash whitespace, cap the length. */
export function scrubForTicket(text: string, max = 600): string {
    const clean = text.replace(EMAIL, "[email removed]").replace(PHONE, "[number removed]").replace(/\s+/g, " ").trim();
    return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** Wrap for a POSIX shell: single quotes, with any ' closed, escaped and reopened. */
export function shellQuote(value: string): string {
    return `'${value.replace(/'/g, `'"'"'`)}'`;
}

/** The `backlog task create` command for a draft. */
export function ticketCommand(draft: TicketDraft): string {
    const title = scrubForTicket(draft.title, 90) || "Untitled";
    const description = [
        `**Why**\n${scrubForTicket(draft.why)}`,
        `**Source**\n${scrubForTicket(draft.source, 200)}`,
        draft.notes ? `**Notes**\n${scrubForTicket(draft.notes)}` : null,
    ]
        .filter(Boolean)
        .join("\n\n");
    const acceptance = draft.acceptance?.length ? draft.acceptance : ["(write what will be true when it's done)"];
    const parts = [
        "backlog task create",
        shellQuote(title),
        `--type ${draft.type}`,
        `-l ${[...new Set(draft.labels)].join(",")}`,
        `--priority ${draft.priority ?? "medium"}`,
        `-m ${shellQuote("Later")}`,
        `-d ${shellQuote(description)}`,
        ...acceptance.map((ac) => `--ac ${shellQuote(scrubForTicket(ac, 200))}`),
    ];
    return parts.join(" ");
}

/** The board label for a contact-form category. */
export function labelForContactCategory(category: string): string {
    switch (category) {
        case "registry":
            return "registry";
        case "shows":
            return "shows";
        case "market":
            return "market";
        case "billing":
            return "billing";
        case "account":
            return "accounts";
        case "report":
            return "moderation";
        default:
            return "platform";
    }
}

/** YYYY-MM-DD for the Source line. */
export function sourceDate(iso: string): string {
    return iso.slice(0, 10);
}
