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
            className="hover:no-underline-min-h)] text-ink-light border-edge inline-flex min-h-[36px] min-h-[var(--opacity-[0.5] cursor-not-allowed cursor-pointer items-center justify-center gap-2 rounded-md border border-[transparent] bg-transparent px-6 px-8 py-1 py-2 font-sans text-base text-sm leading-none font-semibold no-underline transition-all duration-150"
            onClick={handleCopy}
            style={{ fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}
        >
            {copied ? "✅ Link Copied!" : "🔗 Copy Guest Link"}
        </button>
    );
}
