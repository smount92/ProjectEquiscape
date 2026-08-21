"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { RotateCcw } from "lucide-react";

import { restoreHorse } from "@/app/actions/horse";
import { Button } from "@/components/ui/button";

export interface RestoreHorseCardProps {
    id: string;
    /** Pre-scrub name, or null for horses deleted before the stash shipped. */
    recoveredName: string | null;
    referenceName: string | null;
    deletedAt: string;
}

/**
 * One row on the Recently Deleted shelf.
 *
 * Two shapes, because the honest answer differs:
 *  - The name survived → one button, restores it as it was.
 *  - Nothing was stashed (deleted before this feature) → the row says so
 *    and asks for a name inline, rather than restoring a horse called
 *    "[Deleted]" and leaving the member to find the edit form.
 */
export default function RestoreHorseCard({
    id,
    recoveredName,
    referenceName,
    deletedAt,
}: RestoreHorseCardProps) {
    const router = useRouter();
    const [name, setName] = useState("");
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const needsName = recoveredName === null;

    const handleRestore = async () => {
        if (busy) return;
        setBusy(true);
        setError(null);
        const result = await restoreHorse(id, needsName ? name.trim() || undefined : undefined);
        if (!result.success) {
            setError(result.error ?? "Restore failed.");
            setBusy(false);
            return;
        }
        router.push(`/stable/${id}`);
        router.refresh();
    };

    return (
        <li className="ledger-paper flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="min-w-0">
                {recoveredName ? (
                    <p className="m-0 truncate font-serif text-lg font-bold text-foreground">{recoveredName}</p>
                ) : (
                    <p className="m-0 truncate font-serif text-lg font-bold text-muted-foreground italic">
                        Name not recoverable
                    </p>
                )}
                <p className="text-secondary-foreground m-0 text-sm">
                    {referenceName ?? "No catalog reference"}
                    {" · deleted "}
                    {new Date(deletedAt).toLocaleDateString("en-US", {
                        month: "short",
                        day: "numeric",
                        year: "numeric",
                    })}
                </p>
                {needsName && (
                    <p className="text-muted-foreground m-0 mt-1 text-xs">
                        This one was deleted before we started keeping names. Give it a name now, or restore it and
                        rename it on the passport.
                    </p>
                )}
                {error && <p className="text-destructive m-0 mt-1 text-xs">{error}</p>}
            </div>

            <div className="flex shrink-0 flex-wrap items-center gap-2">
                {needsName && (
                    <label className="sr-only" htmlFor={`restore-name-${id}`}>
                        New name for this model
                    </label>
                )}
                {needsName && (
                    <input
                        id={`restore-name-${id}`}
                        type="text"
                        value={name}
                        maxLength={100}
                        onChange={(e) => setName(e.target.value)}
                        placeholder="Name it…"
                        className="border-input bg-card text-foreground w-44 rounded-md border px-3 py-2 text-sm"
                    />
                )}
                <Button onClick={handleRestore} disabled={busy} id={`restore-${id}`}>
                    <RotateCcw size={15} strokeWidth={1.75} />
                    {busy ? "Restoring…" : "Restore"}
                </Button>
            </div>
        </li>
    );
}
