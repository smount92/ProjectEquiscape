"use client";

import { useState } from "react";

import { Button } from "@/components/ui/button";

/**
 * A guest link lets a commissioner who is NOT a member follow the
 * commission room: the thread, the checkpoints, the terms as agreed.
 * Anyone holding the link can read it, it does not expire, and it
 * cannot be revoked short of asking us — so the button says so.
 */
export default function GuestLinkButton({
    commissionId,
    guestToken,
}: {
    commissionId: string;
    guestToken: string;
}) {
    const [copied, setCopied] = useState(false);

    const handleCopy = async () => {
        const url = `${window.location.origin}/studio/commission/${commissionId}?token=${guestToken}`;
        try {
            await navigator.clipboard.writeText(url);
            setCopied(true);
            setTimeout(() => setCopied(false), 2000);
        } catch {
            window.prompt("Copy this link:", url);
        }
    };

    return (
        <Button
            variant="outline"
            size="wide"
            onClick={handleCopy}
            title="A read-only link to this commission for a commissioner without an account. Anyone with the link can open it; it doesn't expire."
        >
            {copied ? "✓ Link copied" : "🔗 Copy guest link"}
        </Button>
    );
}
