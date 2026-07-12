"use client";

import { useState, useTransition } from "react";
import { addToWishlist } from "@/app/actions/wishlist";
import { Button } from "@/components/ui/button";

/**
 * "I want this" — the demand signal on a reference page. Adds the model to the
 * viewer's want list (existing `addToWishlist`); when the Wanted nudge flag is
 * on, that action also privately nudges owners of this model.
 */
export default function WantButton({
    catalogId,
    initiallyWanted,
    isLoggedIn,
}: {
    catalogId: string;
    initiallyWanted: boolean;
    isLoggedIn: boolean;
}) {
    const [wanted, setWanted] = useState(initiallyWanted);
    const [message, setMessage] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    if (!isLoggedIn) {
        return (
            <Button asChild>
                <a href="/login">＋ I want this</a>
            </Button>
        );
    }

    const onClick = () => {
        if (wanted || pending) return;
        startTransition(async () => {
            const res = await addToWishlist(catalogId);
            if (res.success) {
                setWanted(true);
                setMessage("Added to your want list");
            } else {
                if (res.error?.includes("Already")) setWanted(true);
                setMessage(res.error ?? "Something went wrong");
            }
        });
    };

    return (
        <div className="flex items-center gap-2">
            <Button onClick={onClick} disabled={pending || wanted}>
                {wanted ? "✓ On your want list" : pending ? "Adding…" : "＋ I want this"}
            </Button>
            {message && <span className="text-xs text-muted-foreground">{message}</span>}
        </div>
    );
}
