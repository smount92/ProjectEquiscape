"use client";

import { useState, useTransition } from "react";
import {
    confirmWorkRecord,
    disavowWorkRecord,
    setWorkRecordReelPublic,
    deleteWorkRecord,
    type WorkRecordView,
} from "@/app/actions/work-records";

/**
 * The stamp buttons — small and honest. The OWNER confirms a pending
 * credit (or hides the reel from their passport); the CREDITED ARTIST
 * disavows false credit or withdraws their own record. Everything
 * else about a record is content, edited where it was written.
 */
export default function WorkRecordControls({ record }: { record: WorkRecordView }) {
    const [pending, start] = useTransition();
    const [error, setError] = useState<string | null>(null);
    const [done, setDone] = useState<string | null>(null);

    const run = (label: string, fn: () => Promise<{ success: boolean; error?: string }>) => {
        setError(null);
        start(async () => {
            const res = await fn();
            if (res.success) setDone(label);
            else setError(res.error ?? "Something went wrong.");
        });
    };

    if (done) {
        return <p className="text-forest mt-3 mb-0 text-sm font-semibold">✓ {done}</p>;
    }

    const confirmed = record.ownerConfirmedAt != null;

    return (
        <div className="border-border-tan/30 mt-3 flex flex-wrap items-center gap-2 border-t border-dashed pt-3">
            {record.viewerIsOwner && record.awaitingOwner && (
                <>
                    <span className="text-secondary-foreground mr-1 text-sm">
                        This studio recorded work on your horse —
                    </span>
                    <button
                        type="button"
                        disabled={pending}
                        onClick={() => run("Confirmed — the credit is now verified.", () => confirmWorkRecord(record.id, record.horseId))}
                        className="bg-forest rounded-md px-3 py-1 text-sm font-semibold text-white disabled:opacity-50"
                    >
                        Confirm it
                    </button>
                </>
            )}
            {record.viewerIsOwner && (
                <button
                    type="button"
                    disabled={pending}
                    onClick={() =>
                        run(
                            record.reelPublic ? "Reel hidden from the passport." : "Reel shown on the passport.",
                            () => setWorkRecordReelPublic(record.id, !record.reelPublic, record.horseId),
                        )
                    }
                    className="text-secondary-foreground border-input rounded-md border px-3 py-1 text-sm font-medium disabled:opacity-50"
                >
                    {record.reelPublic ? "Hide reel from passport" : "Show reel on passport"}
                </button>
            )}
            {record.viewerIsArtist && record.recordedBy === "artist" && !record.commissionId && (
                <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                        if (window.confirm("Withdraw this work record? Its reel goes with it.")) {
                            run("Record withdrawn.", () => deleteWorkRecord(record.id, record.horseId));
                        }
                    }}
                    className="text-muted-foreground text-sm underline disabled:opacity-50"
                >
                    Withdraw record
                </button>
            )}
            {record.viewerIsArtist && record.recordedBy !== "artist" && !record.disavowedAt && (
                <button
                    type="button"
                    disabled={pending}
                    onClick={() => {
                        if (window.confirm("Disavow this credit? It will leave your wall and this passport.")) {
                            run("Disavowed.", () => disavowWorkRecord(record.id, record.horseId));
                        }
                    }}
                    className="text-destructive text-sm underline disabled:opacity-50"
                >
                    Not my work
                </button>
            )}
            {error && <span className="text-destructive text-sm">{error}</span>}
        </div>
    );
}
