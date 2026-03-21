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
        return (
            <span style={{ fontSize: "calc(var(--font-size-xs) * var(--font-scale))", color: "var(--color-text-muted)" }}>
                ✅ Reported
            </span>
        );
    }

    if (!showForm) {
        return (
            <button
                className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none-ghost"
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
        <div className="bg-bg-card max-[480px]:rounded-[var(--radius-md)] border border-edge rounded-lg p-12 shadow-md transition-all border border-edge rounded-lg p-12 shadow-md transition-all" style={{ padding: "var(--space-md)", marginTop: "var(--space-sm)" }}>
            <select
                className="form-input"
                value={reason}
                onChange={e => setReason(e.target.value)}
                style={{ marginBottom: "var(--space-sm)", fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}
            >
                <option value="">Select a reason…</option>
                {reasons.map(r => (
                    <option key={r} value={r}>{r}</option>
                ))}
            </select>
            <textarea
                className="block w-full min-h-[var(--inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none-min-h)] py-2 px-4 font-sans text-base text-ink bg-input border border-edge-input rounded-md outline-none transition-all duration-150"
                placeholder="Additional details (optional)"
                value={details}
                onChange={e => setDetails(e.target.value)}
                rows={2}
                maxLength={500}
                style={{ marginBottom: "var(--space-sm)", fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}
            />
            {error && <p style={{ color: "#ef4444", fontSize: "calc(var(--font-size-xs) * var(--font-scale))", marginBottom: "var(--space-xs)" }}>{error}</p>}
            <div style={{ display: "flex", gap: "var(--space-xs)" }}>
                <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm min-h-[36px] py-1 px-6 text-sm" onClick={handleSubmit} disabled={saving || !reason}>
                    {saving ? "…" : "Submit Report"}
                </button>
                <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge min-h-[36px] py-1 px-6 text-sm" onClick={() => setShowForm(false)}>Cancel</button>
            </div>
        </div>
    );
}
