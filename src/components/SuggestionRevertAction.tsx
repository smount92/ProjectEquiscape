"use client";

import { useState, useTransition } from "react";
import { revertSuggestion } from "@/app/actions/catalog-suggestions";
import { useRouter } from "next/navigation";
import { useToast } from "@/lib/context/ToastContext";
import { Button } from "@/components/ui/button";

/**
 * SuggestionRevertAction — the admin's one-click undo for an APPLIED
 * correction, shown on approved and auto-approved suggestions.
 *
 * Exists as the counterweight to Silver auto-approval: trusted members'
 * changes go live instantly, so the admin needs an equally fast way back.
 * The action only restores fields the entry still holds the correction's
 * values in — anything corrected again since is kept and reported — and
 * it takes the author's approval credit back, so a reverted change never
 * counts toward the curator ladder.
 */
export default function SuggestionRevertAction({ suggestionId }: { suggestionId: string }) {
    const router = useRouter();
    const { toast } = useToast();
    const [isPending, startTransition] = useTransition();
    const [reason, setReason] = useState("");
    const [confirming, setConfirming] = useState(false);

    const handleRevert = () => {
        startTransition(async () => {
            const result = await revertSuggestion({ suggestionId, reason: reason.trim() });
            if (result.success) {
                const kept = result.drifted?.length
                    ? ` (${result.drifted.join(", ")} changed again since — kept)`
                    : "";
                toast(`↩️ Reverted ${result.reverted?.join(", ")}${kept}. Author notified.`, "success");
                setConfirming(false);
                router.refresh();
            } else {
                toast(result.error ?? "Failed to revert.", "error");
            }
        });
    };

    if (!confirming) {
        return (
            <Button variant="outline" onClick={() => setConfirming(true)}>
                ↩️ Revert this change
            </Button>
        );
    }

    return (
        <div className="flex flex-col gap-2">
            <p className="text-sm text-secondary-foreground">
                Puts the previous values back and returns the approval credit.
                The author sees your reason. Fields corrected again since are
                left alone.
            </p>
            <textarea
                className="input"
                placeholder="Why this is being reverted (required, the author sees it)…"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                rows={2}
            />
            <div className="flex gap-2">
                <Button
                    variant="outline"
                    onClick={handleRevert}
                    disabled={isPending || reason.trim().length < 5}
                >
                    {isPending ? "Reverting…" : "Confirm revert"}
                </Button>
                <Button variant="outline" onClick={() => setConfirming(false)} disabled={isPending}>
                    Cancel
                </Button>
            </div>
        </div>
    );
}
