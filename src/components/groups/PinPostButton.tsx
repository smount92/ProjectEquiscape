"use client";

import { useState, useTransition } from "react";
import { togglePinPost } from "@/app/actions/groups";
import { Button } from "@/components/ui/button";

/**
 * Pin / unpin one notice-board thread. Barn staff only — the server
 * action re-checks the role, this just hides the affordance.
 *
 * (Formerly lived in GroupAdminPanel, whose roster half is now the
 * always-visible BarnMembersPanel on the barn page.)
 */
export function PinPostButton({ postId, isPinned }: { postId: string; isPinned: boolean }) {
    const [pinned, setPinned] = useState(isPinned);
    const [isPending, startTransition] = useTransition();

    const handleToggle = () => {
        startTransition(async () => {
            const result = await togglePinPost(postId);
            if (result.success) setPinned(!pinned);
        });
    };

    return (
        <Button
            variant="outline"
            size="wide"
            className="text-xs"
            onClick={handleToggle}
            disabled={isPending}
            title={pinned ? "Unpin thread" : "Pin thread"}
        >
            📌 {pinned ? "Unpin" : "Pin"}
        </Button>
    );
}

export default PinPostButton;
