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
        <div className="mt-1 gap-1" style={{ display: "flex" }}>
            <button
                className="hover:no-underline-min-h)] text-ink-light border-edge inline-flex min-h-[36px] min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] bg-transparent px-6 px-8 py-1 py-2 font-sans text-base text-sm leading-none font-semibold no-underline transition-all duration-150"
                onClick={handleDismiss}
                disabled={saving}
            >
                ✅ Dismiss
            </button>
            <button
                className="hover:no-underline-min-h)] bg-forest text-inverse inline-flex min-h-[36px] min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-0 border-[transparent] bg-[#ef4444] px-6 px-8 py-1 py-2 font-sans text-base text-sm leading-none font-semibold no-underline shadow-sm transition-all duration-150"
                onClick={handleAction}
                disabled={saving}
            >
                ⚡ Take Action
            </button>
        </div>
    );
}
