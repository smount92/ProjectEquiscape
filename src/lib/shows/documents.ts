/**
 * Horse documentation — the "papers" a judge can check.
 *
 * `horse_documents` (148) is keyed to the HORSE, not the entry: one
 * breed write-up serves every class the horse enters, and it lives
 * on the passport (209 makes a public horse's documents public —
 * the same gate as the passport itself). An entry points at one
 * document (show_class_entries.document_id) and the class room
 * prints it on the card with its links clickable.
 *
 * Shared by the entry dialog, the class room and the passport so
 * the kind labels can never drift between them.
 */

export type DocKind = "breed" | "performance" | "collectibility" | "other";

/** Picker order + short chip labels. */
export const DOC_KINDS: { value: DocKind; label: string }[] = [
    { value: "breed", label: "Breed" },
    { value: "performance", label: "Performance" },
    { value: "collectibility", label: "Collectibility" },
    { value: "other", label: "Other" },
];

/** What the card prints: "<label>: <title>". Keyed loosely — a kind
 *  the app doesn't know yet still renders as plain "Documentation". */
export const DOC_KIND_LABELS: Record<string, string> = {
    breed: "Breed documentation",
    performance: "Performance documentation",
    collectibility: "Collectibility documentation",
    other: "Documentation",
};

/** Mirror the horse_documents CHECKs (148). */
export const MAX_DOC_TITLE = 120;
export const MAX_DOC_BODY = 4000;

export interface HorseDocumentView {
    id: string;
    kind: string;
    title: string;
    bodyMd: string;
    updatedAt: string;
}
