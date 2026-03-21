"use client";

import { useState } from "react";

export default function GuestLinkButton({ commissionId, guestToken }: { commissionId: string; guestToken: string }) {
    const [copied, setCopied] = useState(false);

    const handleCopy = () => {
        const url = `${window.location.origin}/studio/commission/${commissionId}?token=${guestToken}`;
        navigator.clipboard.writeText(url);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    return (
        <button
            className="inline-flex items-center justify-center gap-2 min-h-[var(--opacity-[0.5] cursor-not-allowed hover:no-underline-min-h)] py-2 px-8 font-sans text-base font-semibold rounded-md border border-[transparent] cursor-pointer transition-all duration-150 no-underline leading-none bg-transparent text-ink-light border border-edge min-h-[36px] py-1 px-6 text-sm"
            onClick={handleCopy}
            style={{ fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}
        >
            {copied ? "✅ Link Copied!" : "🔗 Copy Guest Link"}
        </button>
    );
}
