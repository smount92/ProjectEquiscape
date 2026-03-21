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
            <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge min-h-[36px] py-1 px-6 text-sm" onClick={handleDismiss} disabled={saving}>
                ✅ Dismiss
            </button>
            <button className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-forest text-inverse border-0 shadow-sm min-h-[36px] py-1 px-6 text-sm" onClick={handleAction} disabled={saving} style={{ background: "#ef4444" }}>
                ⚡ Take Action
            </button>
        </div>
    );
}
