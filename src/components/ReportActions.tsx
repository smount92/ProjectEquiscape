"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolveReport } from "@/app/actions/moderation";
import { Button } from "@/components/ui/button";

/**
 * The actions on one admin report card. Each one really does something
 * and records a note:
 *
 *   - Take down (the words depend on the kind: "Hide the post", "Scratch
 *     the entry" …): acts on the content, closes the report as actioned.
 *   - Doesn't break the rules: closes it as dismissed.
 *   - Dealt with another way: closes it as actioned; needs a note.
 *   - Suspend @alias: opens the member in Admin › Members, where
 *     suspension already lives (not duplicated here).
 */
export default function ReportActions({
    reportId,
    takeDownLabel,
    ownerAlias,
    onOpenMember,
}: {
    reportId: string;
    /** Null when there's nothing to take down (a member, or it's already down). */
    takeDownLabel: string | null;
    /** The member who made it, for the suspend link. */
    ownerAlias: string | null;
    onOpenMember?: (alias: string) => void;
}) {
    const router = useRouter();
    const noteId = useId();
    const [note, setNote] = useState("");
    const [confirming, setConfirming] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const act = (decision: "dismiss" | "take_down" | "handled") => {
        setError(null);
        startTransition(async () => {
            const result = await resolveReport({ reportId, decision, note: note.trim() || undefined });
            if (result.success) {
                setConfirming(false);
                router.refresh();
            } else {
                setError(result.error);
            }
        });
    };

    return (
        <div className="mt-3 flex flex-col gap-2 border-t border-input pt-3">
            <label htmlFor={noteId} className="text-xs font-semibold text-muted-foreground">
                Note for the record (optional, except for &ldquo;dealt with another way&rdquo;)
            </label>
            <textarea
                id={noteId}
                className="min-h-[40px] w-full rounded-md border border-input bg-transparent px-3 py-1.5 text-sm"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={1}
                maxLength={1000}
            />
            <div className="flex flex-wrap items-center gap-2">
                {takeDownLabel &&
                    (confirming ? (
                        <>
                            <Button variant="destructive" disabled={pending} onClick={() => act("take_down")}>
                                {pending ? "Working…" : `Yes, ${takeDownLabel.toLowerCase()}`}
                            </Button>
                            <Button variant="outline" disabled={pending} onClick={() => setConfirming(false)}>
                                Cancel
                            </Button>
                        </>
                    ) : (
                        <Button variant="destructive-outline" disabled={pending} onClick={() => setConfirming(true)}>
                            {takeDownLabel}
                        </Button>
                    ))}
                <Button variant="outline" disabled={pending} onClick={() => act("dismiss")}>
                    Doesn&apos;t break the rules
                </Button>
                <Button variant="outline" disabled={pending || !note.trim()} onClick={() => act("handled")}>
                    Dealt with another way
                </Button>
                {ownerAlias && onOpenMember && (
                    <button
                        type="button"
                        className="cursor-pointer border-none bg-transparent p-1 text-sm text-forest underline-offset-2 hover:underline"
                        onClick={() => onOpenMember(ownerAlias)}
                    >
                        Suspend @{ownerAlias}…
                    </button>
                )}
            </div>
            {error && (
                <p className="text-sm text-destructive" role="alert">
                    {error}
                </p>
            )}
        </div>
    );
}
