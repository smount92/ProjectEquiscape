/** Thread marks (221): what barn staff can stamp on a thread. */
export const THREAD_STATUSES = ["in_progress", "implemented", "not_planned"] as const;
export type ThreadStatus = (typeof THREAD_STATUSES)[number];

export const THREAD_STATUS_LABEL: Record<ThreadStatus, { glyph: string; label: string; tone: string }> = {
    in_progress: { glyph: "🛠️", label: "In progress", tone: "bg-warning/15 text-warning" },
    implemented: { glyph: "✅", label: "Implemented", tone: "bg-success/15 text-success" },
    not_planned: { glyph: "🚫", label: "Not planned", tone: "bg-muted text-muted-foreground" },
};

export function isThreadStatus(x: unknown): x is ThreadStatus {
    return typeof x === "string" && (THREAD_STATUSES as readonly string[]).includes(x);
}
