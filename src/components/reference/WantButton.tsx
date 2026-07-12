"use client";

import { useState, useEffect, useTransition } from "react";
import { addToWishlist, getWishlistState } from "@/app/actions/wishlist";
import { Button } from "@/components/ui/button";

/**
 * "I want this" — the demand signal on a reference page. Fetches its own
 * per-user state on mount (logged in? already wanted?) so the reference page
 * stays cookie-free and cacheable. Adds the model to the viewer's want list
 * (existing addToWishlist); with the nudge flag on, that also privately nudges
 * owners of this model.
 */
export default function WantButton({ catalogId }: { catalogId: string }) {
    const [loggedIn, setLoggedIn] = useState<boolean | null>(null);
    const [wanted, setWanted] = useState(false);
    const [message, setMessage] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    useEffect(() => {
        let active = true;
        getWishlistState(catalogId).then((s) => {
            if (!active) return;
            setLoggedIn(s.loggedIn);
            setWanted(s.wanted);
        });
        return () => {
            active = false;
        };
    }, [catalogId]);

    if (loggedIn === false) {
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
            <Button onClick={onClick} disabled={pending || wanted || loggedIn === null}>
                {wanted ? "✓ On your want list" : pending ? "Adding…" : "＋ I want this"}
            </Button>
            {message && <span className="text-xs text-muted-foreground">{message}</span>}
        </div>
    );
}
