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
            className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge"
            onClick={handleWithdraw}
            disabled={busy}
            style={{ fontSize: "calc(0.7rem * var(--font-scale))", padding: "2px 8px", color: "var(--color-error, #ef4444)" }}
            title="Withdraw your entry"
        >
            {busy ? "…" : "✕ Withdraw"}
        </button>
    );
}
