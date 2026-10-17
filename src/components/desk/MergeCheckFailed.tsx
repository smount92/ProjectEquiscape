"use client";

import { Button } from "@/components/ui/button";

/**
 * The merge dialogs' check (what moves, and whether update 243 is in)
 * did not come back: say so, keep merging off, and offer to try again.
 * Never read as "update 243 is missing".
 */
export default function MergeCheckFailed({ onRetry }: { onRetry: () => void }) {
    return (
        <div
            className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-destructive/10 px-3 py-2 text-sm text-destructive"
            data-testid="merge-check-failed"
        >
            <span>We couldn&apos;t check this merge just now, so it can&apos;t be sent yet.</span>
            <Button type="button" size="sm" variant="outline" onClick={onRetry}>
                Try again
            </Button>
        </div>
    );
}
