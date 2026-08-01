"use client";

/**
 * Approve / reject controls for one pending external-show listing
 * in the admin Calendar queue. Mirrors SuggestionAdminActions:
 * optional note on approve, required note on reject, toast +
 * refresh on completion. The server action re-gates with
 * requireAdmin() — these buttons are convenience, not authority.
 */

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { reviewExternalShow } from "@/app/actions/external-shows";
import { useToast } from "@/lib/context/ToastContext";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";

export default function ExternalShowAdminActions({ showId }: { showId: string }) {
    const router = useRouter();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [note, setNote] = useState("");
    const [showRejectForm, setShowRejectForm] = useState(false);

    const review = (decision: "approved" | "rejected") => {
        startTransition(async () => {
            const result = await reviewExternalShow({
                id: showId,
                decision,
                note: note.trim() || undefined,
            });
            if (result.success) {
                toast(
                    decision === "approved"
                        ? "✅ Listing approved — it's on the calendar."
                        : "❌ Listing rejected.",
                    "success",
                );
                router.refresh();
            } else {
                toast(result.error ?? "Review failed.", "error");
            }
        });
    };

    return (
        <div className="mt-2 flex flex-col gap-2">
            {!showRejectForm ? (
                <>
                    <div className="flex gap-2">
                        <Button onClick={() => review("approved")} disabled={isPending}>
                            {isPending ? "Working…" : "✅ Approve"}
                        </Button>
                        <Button
                            variant="outline"
                            onClick={() => setShowRejectForm(true)}
                            disabled={isPending}
                        >
                            ❌ Reject
                        </Button>
                    </div>
                    <Input
                        type="text"
                        placeholder="Optional note…"
                        value={note}
                        maxLength={500}
                        onChange={(e) => setNote(e.target.value)}
                    />
                </>
            ) : (
                <div className="flex flex-col gap-2">
                    <Textarea
                        placeholder="Reason for rejection (required)…"
                        value={note}
                        maxLength={500}
                        onChange={(e) => setNote(e.target.value)}
                        rows={2}
                    />
                    <div className="flex gap-2">
                        <Button
                            variant="outline"
                            onClick={() => review("rejected")}
                            disabled={isPending || !note.trim()}
                        >
                            {isPending ? "Rejecting…" : "Confirm Reject"}
                        </Button>
                        <Button variant="outline" onClick={() => setShowRejectForm(false)}>
                            Cancel
                        </Button>
                    </div>
                </div>
            )}
        </div>
    );
}
