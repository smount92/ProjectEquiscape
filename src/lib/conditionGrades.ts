/**
 * Condition grades — the single source of truth for the wear ladder.
 *
 * Shared by the Add Horse and Edit forms (and Quick Add's value list) so
 * the three surfaces can never drift again: the edit form previously
 * lacked Quick Add's "Play Grade" / "Not Graded", which left imported
 * horses with a blank required select and a Save button that could
 * never enable.
 *
 * Every grade carries a one-line plain-English gloss and a severity
 * TONE. Tones are honest states, not judgments — nothing here maps to
 * the destructive red. A Body-grade horse is somebody's next canvas.
 */

export type ConditionTone = "success" | "info" | "warning" | "neutral";

export interface ConditionGrade {
    /** Stored verbatim in user_horses.condition_grade. */
    value: string;
    /** Short display name (same as value today; kept separate for i18n). */
    label: string;
    /** One-line plain-English meaning shown next to the control. */
    gloss: string;
    /** Severity tone — success (top of the ladder), info (solid middle),
     *  warning (honest wear), neutral (not assessed). Never destructive. */
    tone: ConditionTone;
    /** Optional /learn/glossary#<id> anchor for a deeper explanation. */
    glossaryId?: string;
}

export const CONDITION_GRADES: ConditionGrade[] = [
    { value: "Mint", label: "Mint", gloss: "Flawless, like new", tone: "success" },
    { value: "Near Mint", label: "Near Mint", gloss: "Minimal handling wear", tone: "success" },
    { value: "Excellent", label: "Excellent", gloss: "Very light wear, no breaks", tone: "info" },
    { value: "Very Good", label: "Very Good", gloss: "Minor rubs or scuffs", tone: "info" },
    { value: "Good", label: "Good", gloss: "Noticeable wear, still displays well", tone: "info" },
    {
        value: "Body Quality",
        label: "Body Quality",
        gloss: "Suitable for customizing",
        tone: "warning",
        glossaryId: "body",
    },
    { value: "Fair", label: "Fair", gloss: "Visible flaws, repairs, or damage", tone: "warning" },
    { value: "Poor", label: "Poor", gloss: "Significant damage or missing parts", tone: "warning" },
    // Quick Add's two extra states — now legal everywhere.
    { value: "Play Grade", label: "Play Grade", gloss: "Well-loved; heavy play wear throughout", tone: "warning" },
    { value: "Not Graded", label: "Not Graded", gloss: "Condition not assessed yet", tone: "neutral" },
];

/** Look up a grade by stored value (null-safe). */
export function getConditionGrade(value: string | null | undefined): ConditionGrade | null {
    if (!value) return null;
    return CONDITION_GRADES.find((g) => g.value === value) ?? null;
}

/** "Mint — Flawless, like new" — the long option label the forms use. */
export function conditionOptionLabel(grade: ConditionGrade): string {
    return `${grade.label} — ${grade.gloss}`;
}

/**
 * Tone → color token. Token-routed so every tone stays legible in day,
 * Lamplight, and on the parchment card (PARCHMENT_INK pins the same
 * custom properties).
 */
export const CONDITION_TONE_VARS: Record<ConditionTone, string> = {
    success: "var(--color-success)",
    info: "var(--color-info)",
    warning: "var(--color-warning)",
    neutral: "var(--muted-foreground)",
};

/** Convenience: the tone color for a stored grade value. */
export function conditionToneVar(value: string | null | undefined): string {
    const grade = getConditionGrade(value);
    return CONDITION_TONE_VARS[grade?.tone ?? "neutral"];
}
