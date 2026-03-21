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
        if (!confirm("Close this show and calculate final results?\n\nThis will:\n• Rank all entries by vote count\n• Assign placings (1st, 2nd, 3rd…)\n• Auto-generate show records for the top 10\n\nThis cannot be undone.")) return;

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
        <div className="bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all animate-fade-in-up" style={{
            textAlign: "center",
            padding: "var(--space-lg)",
            marginBottom: "var(--space-lg)",
            background: "rgba(20, 184, 166, 0.08)",
            border: "1px solid rgba(20, 184, 166, 0.3)",
        }}>
            <div className="text-[2rem] mb-2" >⏰</div>
            <h3 className="mb-1" >Entry Period Has Ended</h3>
            <p className="text-muted mb-4 text-[calc(0.85rem*var(--font-scale))]" >
                Close this show to calculate results and generate show records for the top finishers.
            </p>
            <button
                className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm"
                onClick={handleClose}
                disabled={busy}
                style={{ minWidth: "220px" }}
            >
                {busy ? "Calculating Results…" : "🏆 Close Show & Calculate Results"}
            </button>
            {error && (
                <p className="flex items-center gap-2 mt-2 py-2 px-4 bg-[rgba(240,108,126,0.1)] border border-[rgba(240,108,126,0.3)] rounded-md text-danger text-sm mt-2">{error}</p>
            )}
        </div>
    );
}
