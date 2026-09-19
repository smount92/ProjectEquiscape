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
 *
 * A horse may carry MANY records — the hobby works in chains
 * (sculpted by one artist, cast by another, prepped by a third,
 * painted by a fourth, restored years later by a fifth), and each
 * link is its own record with its own credit and verification.
 *
 * STAGES BELONG TO THE ARTIST (204). 202 shipped a fixed six-value
 * painter's ladder; the breed-field lesson applies — no closed list
 * fits sculptors, china painters, hairers and tack makers at once.
 * A stage is now the artist's own label; what we provide is suggested
 * ladders per discipline, in the hobby's own words.
 */

/** Caps. Images-per-moment matches the commission WIP cap (8). */
export const MAX_IMAGES_PER_MOMENT = 8;
export const MAX_MOMENTS_PER_RECORD = 40;
export const MAX_STAGE_LABEL = 40;

/**
 * Suggested stage ladders, per discipline. These PREFILL the log-work
 * form; the artist renames, removes, or adds their own. They are
 * suggestions in the UI and nothing more — the reel groups by
 * whatever labels actually arrive, in the order the artist used them.
 */
export const DISCIPLINE_PRESETS: readonly {
    key: string;
    label: string;
    stages: readonly string[];
}[] = [
    {
        key: "finishwork",
        label: "Finishwork / painting",
        stages: ["Reference", "The blank", "Prepped & primed", "Base coat", "Shading", "Details & markings", "Finished"],
    },
    {
        key: "custom",
        label: "Customizing (body mods)",
        stages: ["Reference", "The blank", "Cut & repositioned", "Resculpted", "Primed", "Painted", "Finished"],
    },
    {
        key: "sculpture",
        label: "Original sculpture",
        stages: ["Reference", "Armature", "Bulked out", "Refining", "Detailing", "Ready for casting", "Finished"],
    },
    {
        key: "casting",
        label: "Casting / mold making",
        stages: ["Master prepped", "Mold made", "First pull", "Edition casting", "Finished"],
    },
    {
        key: "china",
        label: "China / glazework",
        stages: ["Reference", "Greenware", "Cleaned & bisqued", "Underglaze", "China paint & fires", "Final fire"],
    },
    {
        key: "hair",
        label: "Hairing",
        stages: ["Reference", "Pattern laid out", "Rooting / applying", "Styling", "Finished"],
    },
    {
        key: "tack",
        label: "Tack & accessories",
        stages: ["Reference", "Design & cutting", "Tooling & dyeing", "Hardware", "Assembly", "Finished"],
    },
    {
        key: "restoration",
        label: "Repair / restoration",
        stages: ["As it arrived", "Repair", "Color matching", "Restored"],
    },
] as const;

/** Per-moment notes cap — DB column is TEXT; this is the app's rule. */
export const MAX_MOMENT_NOTES = 1000;

/**
 * The 202-era enum values, kept as display labels so every moment
 * recorded before 204 still reads as intended. New moments store the
 * label itself.
 */
export const LEGACY_STAGE_LABELS: Record<string, string> = {
    blank: "The blank",
    prep: "Prepped & primed",
    base: "Base coat",
    detail: "Details & markings",
    finished: "Finished",
    progress: "In progress",
};

/** Display label for any stage value, legacy key or artist's own words. */
export function stageLabel(stage: string): string {
    return LEGACY_STAGE_LABELS[stage] ?? stage;
}

/**
 * Group a reel's moments into stages in the order the ARTIST used
 * them — first appearance wins, no fixed ladder. The one exception:
 * catch-all "progress" moments (the workbench default) float last so
 * named chapters tell the story first.
 */
export function groupByStage<T extends { stage: string }>(moments: T[]): [string, T[]][] {
    const groups = new Map<string, T[]>();
    for (const m of moments) {
        const list = groups.get(m.stage) ?? [];
        list.push(m);
        groups.set(m.stage, list);
    }
    const entries = [...groups.entries()];
    const progressIdx = entries.findIndex(([s]) => s === "progress");
    if (progressIdx >= 0 && entries.length > 1) {
        entries.push(entries.splice(progressIdx, 1)[0]);
    }
    return entries;
}

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

// ── Dates on old work ─────────────────────────────────────────────────
// Nobody remembers the day they finished a piece in 2011. A year, or a
// year and month, is an honest answer; the DATE column gets the first of
// it. Future dates are refused — work records are for finished work.

export function parseLooseDate(
    input: string | null | undefined,
    today: Date = new Date(),
): { iso: string | null; error?: string } {
    const s = (input ?? "").trim();
    if (!s) return { iso: null };
    const m = /^(\d{4})(?:-(\d\d?))?(?:-(\d\d?))?$/.exec(s);
    if (!m) {
        return { iso: null, error: "Use a year, a year and month, or a full date — 2019, 2019-03 or 2019-03-14." };
    }
    const y = Number(m[1]);
    const mo = m[2] ? Number(m[2]) : 1;
    const d = m[3] ? Number(m[3]) : 1;
    if (y < 1950 || mo < 1 || mo > 12 || d < 1 || d > 31) {
        return { iso: null, error: "That date doesn't look right." };
    }
    const iso = `${y}-${String(mo).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const dt = new Date(`${iso}T00:00:00Z`);
    if (Number.isNaN(dt.getTime()) || dt.getUTCDate() !== d) {
        return { iso: null, error: "That date doesn't look right." };
    }
    if (dt.getTime() > today.getTime() + 86_400_000) {
        return { iso: null, error: "That's in the future — work records are for finished work." };
    }
    return { iso };
}

/** Started after finished is a typo, not a timeline. */
export function dateOrderError(start: string | null, finished: string | null): string | null {
    if (start && finished && start > finished) return "Started comes after finished — check the dates.";
    return null;
}

/** Picking a ladder says what the work was; the work type follows unless
 *  the ladder has no billable counterpart (casting). */
export const WORK_TYPE_FOR_DISCIPLINE: Record<string, string> = {
    finishwork: "Finishwork (repaint)",
    custom: "Custom (sculpting)",
    sculpture: "Custom (sculpting)",
    china: "China painting",
    hair: "Hair / mane & tail",
    tack: "Tack making",
    restoration: "Repair & restoration",
};
