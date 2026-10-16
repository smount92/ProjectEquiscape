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

/** "a post", "an entry": the article for a noun in a sentence. */
export function withArticle(noun: string): string {
    return /^[aeiou]/i.test(noun) ? `an ${noun}` : `a ${noun}`;
}

/** The longest report details a member can write. */
export const REPORT_DETAILS_MAX = 500;
