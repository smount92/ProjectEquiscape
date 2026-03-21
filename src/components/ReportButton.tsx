"use client";

import { useState, useEffect } from "react";
import { submitReport, getReportReasons } from "@/app/actions/moderation";

export default function ReportButton({
    targetType,
    targetId,
}: {
    targetType: "post" | "horse" | "user" | "comment" | "message";
    targetId: string;
}) {
    const [showForm, setShowForm] = useState(false);
    const [reason, setReason] = useState("");
    const [details, setDetails] = useState("");
    const [saving, setSaving] = useState(false);
    const [done, setDone] = useState(false);
    const [error, setError] = useState("");
    const [reasons, setReasons] = useState<string[]>([]);

    useEffect(() => {
        if (showForm && reasons.length === 0) {
            getReportReasons().then(setReasons);
        }
    }, [showForm, reasons.length]);

    const handleSubmit = async () => {
        if (!reason) return;
        setSaving(true);
        setError("");
        const result = await submitReport({
            targetType,
            targetId,
            reason,
            details: details.trim() || undefined,
        });
        if (result.success) {
            setDone(true);
        } else {
            setError(result.error || "Failed to submit report.");
        }
        setSaving(false);
    };

    if (done) {
        return <span className="text-muted text-xs">✅ Reported</span>;
    }

    if (!showForm) {
        return (
            <button
                className="hover:no-underline-min-h)] leading-none-ghost inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] px-8 py-2 font-sans text-base font-semibold no-underline transition-all duration-150"
                onClick={() => setShowForm(true)}
                style={{
                    fontSize: "calc(var(--font-size-xs) * var(--font-scale))",
                    color: "var(--color-text-muted)",
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    padding: "var(--space-xs)",
                }}
                title="Report"
            >
                🚩 Report
            </button>
        );
    }

    return (
        <div className="bg-bg-card border-edge border-edge mt-2 rounded-lg border p-4 p-12 shadow-md transition-all max-[480px]:rounded-[var(--radius-md)]">
            <select
                className="form-input"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                style={{ marginBottom: "var(--space-sm)", fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}
            >
                <option value="">Select a reason…</option>
                {reasons.map((r) => (
                    <option key={r} value={r}>
                        {r}
                    </option>
                ))}
            </select>
            <textarea
                className="min-h-[var(--inline-flex hover:no-underline-min-h)] leading-none-min-h)] text-ink bg-input border-edge-input block min-h-[var(--opacity-[0.5] w-full cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] px-4 px-8 py-2 font-sans text-base font-semibold no-underline transition-all duration-150 outline-none"
                placeholder="Additional details (optional)"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                rows={2}
                maxLength={500}
                style={{ marginBottom: "var(--space-sm)", fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}
            />
            {error && <p className="mb-1 text-xs text-[#ef4444]">{error}</p>}
            <div className="gap-1" style={{ display: "flex" }}>
                <button
                    className="hover:no-underline-min-h)] bg-forest text-inverse inline-flex min-h-[36px] min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-0 border-[transparent] px-6 px-8 py-1 py-2 font-sans text-base text-sm leading-none font-semibold no-underline shadow-sm transition-all duration-150"
                    onClick={handleSubmit}
                    disabled={saving || !reason}
                >
                    {saving ? "…" : "Submit Report"}
                </button>
                <button
                    className="hover:no-underline-min-h)] text-ink-light border-edge inline-flex min-h-[36px] min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] bg-transparent px-6 px-8 py-1 py-2 font-sans text-base text-sm leading-none font-semibold no-underline transition-all duration-150"
                    onClick={() => setShowForm(false)}
                >
                    Cancel
                </button>
            </div>
        </div>
    );
}
