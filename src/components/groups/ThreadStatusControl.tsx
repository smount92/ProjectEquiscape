"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { setThreadStatus } from "@/app/actions/groups";
import { THREAD_STATUS_LABEL, THREAD_STATUSES, type ThreadStatus } from "@/lib/groups/threadStatus";

/**
 * Mark a thread In progress / Implemented / Not planned. Barn staff
 * only — the server action re-checks the role, this just hides the
 * affordance. Sits beside the pin button on the thread page.
 */
export function ThreadStatusControl({ postId, status }: { postId: string; status: ThreadStatus | null }) {
    const router = useRouter();
    const [current, setCurrent] = useState<ThreadStatus | null>(status);
    const [error, setError] = useState<string | null>(null);
    const [isPending, startTransition] = useTransition();

    const pick = (value: string) => {
        const next = (value || null) as ThreadStatus | null;
        setError(null);
        startTransition(async () => {
            const result = await setThreadStatus(postId, next);
            if (result.success) {
                setCurrent(next);
                router.refresh();
            } else {
                setError(result.error ?? "Could not save.");
            }
        });
    };

    return (
        <label className="flex items-center gap-2 text-xs">
            <span className="text-muted-foreground">Mark</span>
            <select
                className="border-input bg-card text-foreground h-9 rounded-md border px-2 text-xs"
                value={current ?? ""}
                onChange={(e) => pick(e.target.value)}
                disabled={isPending}
                aria-label="Thread status"
                id="thread-status"
            >
                <option value="">No mark</option>
                {THREAD_STATUSES.map((s) => (
                    <option key={s} value={s}>
                        {THREAD_STATUS_LABEL[s].glyph} {THREAD_STATUS_LABEL[s].label}
                    </option>
                ))}
            </select>
            {error && <span className="text-destructive">{error}</span>}
        </label>
    );
}

/** The stamp itself, for the board row and the thread header. */
export function ThreadStatusBadge({ status, compact = false }: { status: ThreadStatus | null | undefined; compact?: boolean }) {
    if (!status || !(status in THREAD_STATUS_LABEL)) return null;
    const meta = THREAD_STATUS_LABEL[status];
    return (
        <span
            className={`inline-flex items-center gap-1 rounded-sm px-1.5 py-[1px] text-[0.65rem] font-bold tracking-wider uppercase ${meta.tone}`}
            title={meta.label}
            data-testid="thread-status"
        >
            <span aria-hidden="true">{meta.glyph}</span>
            {!compact && meta.label}
        </span>
    );
}

export default ThreadStatusControl;
