/**
 * What a contact message is about (migration 236's CHECK list; keep equal).
 * The member picks one on /contact; the owner filters by it in the mailbox.
 */
export const CONTACT_CATEGORIES = [
    { value: "question", label: "A question" },
    { value: "problem", label: "Something isn't working" },
    { value: "registry", label: "The Registry (a model, a mold, a correction)" },
    { value: "account", label: "My account or login" },
    { value: "billing", label: "Payments or my membership" },
    { value: "shows", label: "A show" },
    { value: "market", label: "A sale or the Market" },
    { value: "report", label: "Reporting a member or content" },
    { value: "idea", label: "An idea for the site" },
    { value: "other", label: "Something else" },
] as const;

export type ContactCategory = (typeof CONTACT_CATEGORIES)[number]["value"];

export function isContactCategory(v: unknown): v is ContactCategory {
    return CONTACT_CATEGORIES.some((c) => c.value === v);
}

export function contactCategoryLabel(v: string): string {
    return CONTACT_CATEGORIES.find((c) => c.value === v)?.label ?? "Something else";
}
