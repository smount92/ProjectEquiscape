"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { ticketCommand, type TicketDraft } from "@/lib/admin/ticketDraft";

/**
 * "Copy as ticket" (MHH-028): copies the `backlog task create` command for
 * this item, to paste into a terminal or hand to Claude.
 */
export default function CopyAsTicketButton({ draft }: { draft: TicketDraft }) {
    const [state, setState] = useState<"idle" | "copied" | "failed">("idle");

    const copy = async () => {
        try {
            await navigator.clipboard.writeText(ticketCommand(draft));
            setState("copied");
        } catch {
            setState("failed");
        }
        window.setTimeout(() => setState("idle"), 2500);
    };

    return (
        <>
            <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={copy}
                title="Copies the backlog command for this, to paste into a terminal or to Claude"
            >
                {state === "copied" ? "Copied" : "Copy as ticket"}
            </Button>
            <span role="status" className="sr-only">
                {state === "copied" ? "Ticket command copied" : state === "failed" ? "Couldn't copy" : ""}
            </span>
            {state === "failed" && <span className="text-xs text-destructive">Couldn&apos;t copy; try again.</span>}
        </>
    );
}
