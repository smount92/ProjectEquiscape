"use client";

import { useState } from "react";
import { dismissReport, actionReport } from "@/app/actions/moderation";
import { useRouter } from "next/navigation";

export default function ReportActions({ reportId }: { reportId: string }) {
    const router = useRouter();
    const [saving, setSaving] = useState(false);

    const handleDismiss = async () => {
        setSaving(true);
        await dismissReport(reportId);
        router.refresh();
    };

    const handleAction = async () => {
        const notes = prompt("Admin notes (what action was taken):");
        if (!notes) return;
        setSaving(true);
        await actionReport(reportId, notes);
        router.refresh();
    };

    return (
        <div style={{ display: "flex", gap: "var(--space-xs)", marginTop: "var(--space-xs)" }}>
            <button className="btn btn-ghost btn-sm" onClick={handleDismiss} disabled={saving}>
                ✅ Dismiss
            </button>
            <button className="btn btn-primary btn-sm" onClick={handleAction} disabled={saving} style={{ background: "#ef4444" }}>
                ⚡ Take Action
            </button>
        </div>
    );
}
