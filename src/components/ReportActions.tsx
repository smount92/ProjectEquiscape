"use client";

import { useId, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { resolveReport } from "@/app/actions/moderation";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

/**
 * The actions on one admin report card. Each one really does something
 * and records a note:
 *
 *   - Take down (the words depend on the kind: "Hide the post", "Scratch
 *     the entry" …): acts on the content, closes the report as actioned.
 *   - Doesn't break the rules: closes it as dismissed and tells the
 *     reporter so.
 *   - Dealt with another way: closes it as actioned; needs a note.
 *   - Suspend @alias: opens the member in Admin › Members, where
 *     suspension already lives (not duplicated here).
 *
 * The first two tell members something that can't be taken back, so each
 * asks "Yes, …?" first.
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
    const [confirming, setConfirming] = useState<"take_down" | "dismiss" | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const act = (decision: "dismiss" | "take_down" | "handled") => {
        setError(null);
        startTransition(async () => {
            const result = await resolveReport({ reportId, decision, note: note.trim() || undefined });
            if (result.success) {
                setConfirming(null);
                router.refresh();
            } else {
                setConfirming(null);
                setError(result.error);
            }
        });
    };

    const confirmRow = (decision: "take_down" | "dismiss", yes: string) => (
        <>
            <Button
                variant={decision === "take_down" ? "destructive" : "default"}
                disabled={pending}
                onClick={() => act(decision)}
            >
                {pending ? "Working…" : yes}
            </Button>
            <Button variant="outline" disabled={pending} onClick={() => setConfirming(null)}>
                Cancel
            </Button>
        </>
    );

    return (
        <div className="mt-3 flex flex-col gap-2 border-t border-input pt-3">
            <label htmlFor={noteId} className="text-xs font-semibold text-muted-foreground">
                Note for the record (optional, except for &ldquo;dealt with another way&rdquo;)
            </label>
            <Textarea
                id={noteId}
                className="min-h-[40px] py-1.5"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                rows={1}
                maxLength={1000}
            />
            <div className="flex flex-wrap items-center gap-2">
                {confirming === "take_down" && takeDownLabel ? (
                    confirmRow("take_down", `Yes, ${takeDownLabel.toLowerCase()}`)
                ) : confirming === "dismiss" ? (
                    confirmRow("dismiss", "Yes, it doesn't break the rules")
                ) : (
                    <>
                        {takeDownLabel && (
                            <Button
                                variant="destructive-outline"
                                disabled={pending}
                                onClick={() => setConfirming("take_down")}
                            >
                                {takeDownLabel}
                            </Button>
                        )}
                        <Button variant="outline" disabled={pending} onClick={() => setConfirming("dismiss")}>
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
                    </>
                )}
            </div>
            {error && (
                <p className="text-sm text-destructive" role="alert">
                    <WithInboxLinks text={error} />
                </p>
            )}
        </div>
    );
}

/**
 * The server's words, with any Deal Room address in them ("/inbox/<id>",
 * from a take-down that waits for a sale) made into a link.
 */
function WithInboxLinks({ text }: { text: string }) {
    const parts = text.split(/(\/inbox\/[0-9a-f-]+)/i);
    return (
        <>
            {parts.map((part, i) =>
                /^\/inbox\/[0-9a-f-]+$/i.test(part) ? (
                    <a key={i} href={part} className="underline">
                        open it
                    </a>
                ) : (
                    part
                ),
            )}
        </>
    );
}
