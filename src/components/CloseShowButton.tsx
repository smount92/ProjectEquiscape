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
        <div className="card animate-fade-in-up" style={{
            textAlign: "center",
            padding: "var(--space-lg)",
            marginBottom: "var(--space-lg)",
            background: "rgba(20, 184, 166, 0.08)",
            border: "1px solid rgba(20, 184, 166, 0.3)",
        }}>
            <div style={{ fontSize: "2rem", marginBottom: "var(--space-sm)" }}>⏰</div>
            <h3 style={{ marginBottom: "var(--space-xs)" }}>Entry Period Has Ended</h3>
            <p style={{ color: "var(--color-text-muted)", marginBottom: "var(--space-md)", fontSize: "calc(0.85rem * var(--font-scale))" }}>
                Close this show to calculate results and generate show records for the top finishers.
            </p>
            <button
                className="btn btn-primary"
                onClick={handleClose}
                disabled={busy}
                style={{ minWidth: "220px" }}
            >
                {busy ? "Calculating Results…" : "🏆 Close Show & Calculate Results"}
            </button>
            {error && (
                <p className="form-error" style={{ marginTop: "var(--space-sm)" }}>{error}</p>
            )}
        </div>
    );
}
