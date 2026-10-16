/**
 * Content reports: the one vocabulary.
 *
 * What a member can report, the reasons they pick from, and the words used
 * for each kind of thing. The Report button, the server action, the admin
 * Reports tab and the outcome notifications all read from here, and the
 * database CHECK on user_reports.target_type (migration 235) holds the same
 * list (`src/lib/moderation/__tests__/reports.test.ts` keeps them equal).
 *
 * Pure: no I/O, safe to import from client components.
 */

/**
 * Every kind of thing a member can report.
 *
 * A market listing is reported as a `horse`: the passport *is* the listing
 * (docs/GLOSSARY.md), so one report covers both, and taking it down takes
 * the listing down with the page. Barn threads and their replies are rows
 * in `posts`, exactly like feed posts, so they are `post` and `comment`.
 */
export const REPORT_TARGET_TYPES = [
    "post",
    "comment",
    "horse",
    "user",
    "message",
    "show_entry",
    "id_request",
    "id_suggestion",
] as const;

export type ReportTargetType = (typeof REPORT_TARGET_TYPES)[number];

/** The five the table accepted before migration 235. */
export const REPORT_TARGET_TYPES_BEFORE_235: readonly ReportTargetType[] = [
    "post",
    "comment",
    "horse",
    "user",
    "message",
];

export function isReportTargetType(value: unknown): value is ReportTargetType {
    return typeof value === "string" && (REPORT_TARGET_TYPES as readonly string[]).includes(value);
}

export const REPORT_REASONS = [
    "Spam or scam",
    "Harassment or bullying",
    "Inappropriate content",
    "Fake listing or misrepresentation",
    "Copyright violation",
    "Other",
] as const;

export type ReportReason = (typeof REPORT_REASONS)[number];

/** How a member would name the thing: "Report this ___". */
export const REPORT_TARGET_NOUN: Record<ReportTargetType, string> = {
    post: "post",
    comment: "reply",
    horse: "horse",
    user: "member",
    message: "message",
    show_entry: "show entry",
    id_request: "Help ID request",
    id_suggestion: "suggestion",
};

/** The label on the admin card. */
export const REPORT_TARGET_LABEL: Record<ReportTargetType, string> = {
    post: "Post",
    comment: "Reply",
    horse: "Horse or listing",
    user: "Member",
    message: "Private message",
    show_entry: "Show entry",
    id_request: "Help ID request",
    id_suggestion: "Help ID suggestion",
};

/**
 * The take-down button on an admin report card, per kind. Every one is
 * reversible and keeps the member's data: posts, replies and Help ID rows
 * are hidden (migration 235), a message is marked removed, a horse is made
 * private (which ends its listing), a show entry is scratched. A member has
 * no take-down here: suspension lives in Admin › Members.
 */
export const REPORT_TAKE_DOWN_LABEL: Record<ReportTargetType, string | null> = {
    post: "Hide the post",
    comment: "Hide the reply",
    horse: "Make the horse private",
    user: null,
    message: "Remove the message",
    show_entry: "Scratch the entry",
    id_request: "Hide the request",
    id_suggestion: "Hide the suggestion",
};

/** The rules a take-down points at, as the notices name them. */
export const COMMUNITY_RULES = "our Community Conduct rules (Terms, section 6)";

/** The Community Conduct section of the Terms, where a link can carry it. */
export const COMMUNITY_RULES_URL = "/terms#community-conduct";

/** Where a member writes to us about a report or a take-down. */
export const REPORT_CONTACT_URL = "/contact?category=report";

/**
 * What the member who made it is told when it comes down, naming the thing
 * (`name`: a horse's name, a post's title or the start of its words) so
 * they know which one. Without a name it falls back to "one of your …".
 */
export function takeDownNotice(type: ReportTargetType, name: string | null): string {
    const quoted = name ? ` "${name}"` : "";
    const because = `because it breaks ${COMMUNITY_RULES}.`;
    switch (type) {
        case "post":
            return `We hid ${name ? `your post${quoted}` : "one of your posts"} ${because}`;
        case "comment":
            return `We hid ${name ? `your reply${quoted}` : "one of your replies"} ${because}`;
        case "horse":
            return `We made ${name ? `your horse${quoted}` : "one of your horses"} private, which also takes it off the Market, because its page breaks ${COMMUNITY_RULES}.`;
        case "message":
            return `We removed ${name ? `your message${quoted}` : "a message you sent"} ${because}`;
        case "show_entry":
            return `We scratched ${name ? `your show entry${quoted}` : "one of your show entries"} ${because}`;
        case "id_request":
            return `We hid your Help ID request${quoted} ${because}`;
        case "id_suggestion":
            return `We hid ${name ? `your Help ID suggestion${quoted}` : "one of your Help ID suggestions"} ${because}`;
        case "user":
            return "";
    }
}

/**
 * What the member who reported it hears when the report is closed: what
 * happened to the thing, and nothing about anyone (never which member, never
 * a suspension; "dealt with another way" is said neutrally for that reason).
 * It quotes none of the reported words, names or titles: a member who
 * reported abuse must not find it repeated in their own bell (owner,
 * 2026-10-15). The owner of the content is the one told which item.
 */
export function reportOutcomeNotice(
    decision: "dismiss" | "take_down" | "handled",
    targetType: ReportTargetType | null,
): string {
    const noun = targetType ? REPORT_TARGET_NOUN[targetType] : "post";
    const thanks = `Thank you for reporting that ${noun}.`;
    if (decision === "take_down") return `${thanks} We looked into it and removed it.`;
    if (decision === "handled") return `${thanks} We've reviewed your report and closed it.`;
    return `${thanks} We looked, and it doesn't break ${COMMUNITY_RULES}, so we've left it up.`;
}

/** Said after every take-down notice: the way to reach us. */
export const TAKE_DOWN_APPEAL = "If you think we got it wrong, write to us through the contact page.";

/** How long a quoted post or message may be in a notice. */
export const NOTICE_EXCERPT = 60;

/** A reported thing as the admin card shows it (built in reportTargets.ts). */
export interface ReportTargetView {
    /** What the admin reads on the card: a name, a title, or a short excerpt. */
    summary: string;
    /**
     * What a notice calls it: a horse's name, a post's title or the start of
     * its words (NOTICE_EXCERPT), "@alias" for a member. Null when there is
     * nothing to name (it is gone, or a photo with no words).
     */
    name: string | null;
    /** The page it lives on, or null when there is none to open (a private message). */
    href: string | null;
    /** The member who made it (for a member report, the member). */
    ownerId: string | null;
    ownerAlias: string | null;
    /** Where it stands now, in a word or two: "Hidden", "Private", "Scratched" … */
    state: string | null;
    /** The take-down button's words, or null when there is nothing to take down here. */
    takeDownLabel: string | null;
}

/** "a post", "an entry": the article for a noun in a sentence. */
export function withArticle(noun: string): string {
    return /^[aeiou]/i.test(noun) ? `an ${noun}` : `a ${noun}`;
}

/** The longest report details a member can write. */
export const REPORT_DETAILS_MAX = 500;

/** Where the admin bell sends the owner: the console, opened on Reports. */
export const ADMIN_REPORTS_URL = "/admin?tab=reports";
