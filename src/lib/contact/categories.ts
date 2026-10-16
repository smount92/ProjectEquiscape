/**
 * What a contact message is about (migration 236's CHECK list; keep equal).
 * The member picks one on /contact by `label`; the owner sees `ownerLabel`
 * in the bell notice and the mailbox, written for the person sorting the
 * mail rather than the person writing in.
 */
export const CONTACT_CATEGORIES = [
    { value: "question", label: "A question", ownerLabel: "Question" },
    { value: "problem", label: "Something isn't working", ownerLabel: "Problem" },
    { value: "registry", label: "The Registry (a model, a mold, a correction)", ownerLabel: "Registry" },
    { value: "account", label: "My account or login", ownerLabel: "Account" },
    { value: "billing", label: "Payments or my membership", ownerLabel: "Billing" },
    { value: "shows", label: "A show", ownerLabel: "Shows" },
    { value: "market", label: "A sale or the Market", ownerLabel: "Market" },
    { value: "report", label: "Reporting a member or content", ownerLabel: "Report" },
    { value: "idea", label: "An idea for the site", ownerLabel: "Idea" },
    { value: "other", label: "Something else", ownerLabel: "Other" },
] as const;

export type ContactCategory = (typeof CONTACT_CATEGORIES)[number]["value"];

export function isContactCategory(v: unknown): v is ContactCategory {
    return CONTACT_CATEGORIES.some((c) => c.value === v);
}

/**
 * The category /contact opens on: `?category=` when it names a real one
 * (moderation notices link to /contact?category=report), "problem" when an
 * error page sent the member, else "question". Anything else is ignored.
 */
export function initialContactCategory(asked: unknown, fromErrorPage: boolean): ContactCategory {
    if (isContactCategory(asked)) return asked;
    return fromErrorPage ? "problem" : "question";
}

/** The member's wording, as the form offers it. */
export function contactCategoryLabel(v: string): string {
    return CONTACT_CATEGORIES.find((c) => c.value === v)?.label ?? "Something else";
}

/** The owner's short wording, for the bell notice and the mailbox chip. */
export function contactCategoryOwnerLabel(v: string): string {
    return CONTACT_CATEGORIES.find((c) => c.value === v)?.ownerLabel ?? "Other";
}
