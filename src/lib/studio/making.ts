/**
 * The Making — pure vocabulary and rules for work records and their
 * reels. No I/O; imported by client components and server actions
 * alike so the two can never disagree about a stage name or a cap.
 *
 * A work record (customization_logs row, extended in 202) is the
 * studio's atom: this horse + this artist + what was done. Its reel
 * (work_moments) is the chronological, staged story — "The Making" —
 * rendered on the passport with the owner's consent and on the
 * studio's wall always.
 */

/** The stages of a piece, in the order work actually happens. */
export const WORK_STAGES = ["blank", "prep", "base", "detail", "finished", "progress"] as const;
export type WorkStage = (typeof WORK_STAGES)[number];

export const STAGE_LABELS: Record<WorkStage, string> = {
    blank: "The blank",
    prep: "Prepped & primed",
    base: "Base coat",
    detail: "Details & markings",
    finished: "Finished",
    progress: "In progress",
};

/** Display order for grouping a reel by stage ("progress" floats last). */
export const STAGE_ORDER: Record<WorkStage, number> = {
    blank: 0, prep: 1, base: 2, detail: 3, finished: 4, progress: 5,
};

/**
 * Caps. Images-per-moment matches the commission WIP cap (8) so the
 * two surfaces feel like one system. Moments-per-record is generous —
 * a reel is a story, not unlimited storage.
 */
export const MAX_IMAGES_PER_MOMENT = 8;
export const MAX_MOMENTS_PER_RECORD = 40;

/** Reel upload path inside the horse-images bucket. Validated server-side. */
export function makingImagePrefix(horseId: string): string {
    return `horses/${horseId}/making_`;
}

export function isValidMakingPath(path: string, horseId: string): boolean {
    // No traversal, no absolute URLs, exactly our prefix.
    if (path.includes("..") || path.includes("//") || path.startsWith("http")) return false;
    return path.startsWith(makingImagePrefix(horseId));
}

/**
 * Verification labels — the manual-vs-verified show-record pattern
 * applied to credit. A claim is labeled a claim until the other party
 * confirms it.
 */
export function creditLabel(rec: {
    recordedBy: string;
    ownerConfirmedAt: string | null;
    artistIsOwner: boolean;
}): { label: string; verified: boolean } {
    if (rec.ownerConfirmedAt) return { label: "Confirmed by owner", verified: true };
    if (rec.recordedBy === "commission") return { label: "Commission — verified", verified: true };
    if (rec.artistIsOwner) return { label: "Recorded by the artist", verified: true };
    if (rec.recordedBy === "owner") return { label: "Recorded by owner", verified: false };
    return { label: "Recorded by artist — awaiting owner", verified: false };
}
