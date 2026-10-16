import type { DeskFlag } from "@/app/actions/registry-desk";

/** Problems that are plainly wrong (red), notes that are only worth a look (grey); the rest need work (amber). */
const WRONG = new Set(["no_colour", "number_clash", "duplicate_release", "wrong_scale", "no_mold"]);
// "Whole set in the title" is a note, not a problem, until a style rule says otherwise (owner, 2026-10-16).
const NOTE = new Set(["roster_in_title", "colour_in_title", "year_as_text"]);

export function flagTone(key: string): "wrong" | "note" | "work" {
    if (WRONG.has(key)) return "wrong";
    if (NOTE.has(key)) return "note";
    return "work";
}

const TONE_CLASS = {
    wrong: "bg-destructive/10 text-destructive",
    note: "bg-muted text-muted-foreground",
    work: "bg-warning/15 text-warning",
} as const;

export default function FlagChips({ flags, className = "" }: { flags: DeskFlag[]; className?: string }) {
    if (flags.length === 0) return null;
    return (
        <ul className={`m-0 flex list-none flex-wrap gap-1 p-0 ${className}`} aria-label="What needs a look">
            {flags.map((f) => (
                <li
                    key={f.key}
                    data-tone={flagTone(f.key)}
                    className={`rounded-full px-2 py-0.5 text-xs font-semibold ${TONE_CLASS[flagTone(f.key)]}`}
                >
                    {f.label}
                </li>
            ))}
        </ul>
    );
}
