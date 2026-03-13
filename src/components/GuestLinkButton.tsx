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
            className="btn btn-ghost btn-sm"
            onClick={handleCopy}
            style={{ fontSize: "calc(var(--font-size-sm) * var(--font-scale))" }}
        >
            {copied ? "✅ Link Copied!" : "🔗 Copy Guest Link"}
        </button>
    );
}
