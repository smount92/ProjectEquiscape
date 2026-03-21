"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { withdrawEntry } from "@/app/actions/shows";

export default function WithdrawButton({ entryId }: { entryId: string }) {
    const router = useRouter();
    const [busy, setBusy] = useState(false);

    const handleWithdraw = async () => {
        if (!confirm("Remove your entry from this show?")) return;
        setBusy(true);
        await withdrawEntry(entryId);
        router.refresh();
    };

    return (
        <button
            className="inline-flex min-h-[36px] cursor-pointer items-center justify-center gap-2 rounded-md border border-edge bg-transparent px-8 py-2 text-sm font-semibold text-ink-light no-underline transition-all"
            onClick={handleWithdraw}
            disabled={busy}
            style={{
                fontSize: "calc(0.7rem * var(--font-scale))",
                padding: "2px 8px",
                color: "var(--color-error, #ef4444)",
            }}
            title="Withdraw your entry"
        >
            {busy ? "…" : "✕ Withdraw"}
        </button>
    );
}
