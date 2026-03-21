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
            className="hover:no-underline-min-h)] text-ink-light border-edge inline-flex min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] bg-transparent px-8 py-2 font-sans text-base leading-none font-semibold no-underline transition-all duration-150"
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
