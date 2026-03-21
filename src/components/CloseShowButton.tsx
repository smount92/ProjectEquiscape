"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { updateShowStatus } from "@/app/actions/shows";

interface CloseShowButtonProps {
    showId: string;
}

export default function CloseShowButton({ showId }: CloseShowButtonProps) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState("");

    const handleClose = async () => {
        if (
            !confirm(
                "Close this show and calculate final results?\n\nThis will:\n• Rank all entries by vote count\n• Assign placings (1st, 2nd, 3rd…)\n• Auto-generate show records for the top 10\n\nThis cannot be undone.",
            )
        )
            return;

        setBusy(true);
        setError("");
        const result = await updateShowStatus(showId, "closed");
        if (result.success) {
            router.refresh();
        } else {
            setError(result.error || "Failed to close show.");
        }
        setBusy(false);
    };

    return (
        <div
            className="bg-card border-edge animate-fade-in-up rounded-lg border p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]"
            style={{
                textAlign: "center",
                padding: "var(--space-lg)",
                marginBottom: "var(--space-lg)",
                background: "rgba(20, 184, 166, 0.08)",
                border: "1px solid rgba(20, 184, 166, 0.3)",
            }}
        >
            <div className="mb-2 text-[2rem]">⏰</div>
            <h3 className="mb-1">Entry Period Has Ended</h3>
            <p className="text-muted mb-4 text-[calc(0.85rem*var(--font-scale))]">
                Close this show to calculate results and generate show records for the top finishers.
            </p>
            <button
                className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border-0 bg-forest px-6 py-1 text-sm font-semibold text-inverse no-underline shadow-sm transition-all"
                onClick={handleClose}
                disabled={busy}
                style={{ minWidth: "220px" }}
            >
                {busy ? "Calculating Results…" : "🏆 Close Show & Calculate Results"}
            </button>
            {error && (
                <p className="text-danger mt-2 flex items-center gap-2 rounded-md border border-[rgba(240,108,126,0.3)] bg-[rgba(240,108,126,0.1)] px-4 py-2 text-sm">
                    {error}
                </p>
            )}
        </div>
    );
}
