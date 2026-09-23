"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";

import { setStudioListed } from "@/app/actions/art-studio";

/**
 * Whether the studio is out in public at all: on the Art Studios
 * directory and reachable by its page. Off = only the owner can open the
 * page; the directory, the passports' artist links and search all skip
 * it. The column (portfolio_visible) had existed since 170 with nothing
 * in the UI to set it (owner, 2026-09-22).
 */
export default function StudioListingToggle({ listed }: { listed: boolean }) {
    const router = useRouter();
    const [on, setOn] = useState(listed);
    const [error, setError] = useState<string | null>(null);
    const [pending, start] = useTransition();

    const flip = (next: boolean) => {
        setError(null);
        start(async () => {
            const result = await setStudioListed(next);
            if (result.success) {
                setOn(next);
                router.refresh();
            } else {
                setError(result.error ?? "Could not save.");
            }
        });
    };

    return (
        <div className="bg-card border-input rounded-lg border p-6 shadow-md" data-testid="studio-listing">
            <label className="flex items-start gap-3">
                <input
                    id="studio-listed"
                    type="checkbox"
                    className="mt-1"
                    checked={on}
                    disabled={pending}
                    onChange={(e) => flip(e.target.checked)}
                />
                <span>
                    <span className="block text-base font-bold">Listed in the Art Studios directory</span>
                    <span className="text-secondary-foreground block text-sm">
                        {on
                            ? "Your studio is public: on the directory, reachable by its page, linked from the horses you have worked on."
                            : "Your studio is hidden: not on the directory, and only you can open its page. Your work records and commissions are untouched."}
                    </span>
                </span>
            </label>
            {error && <p className="text-destructive m-0 mt-2 text-sm">{error}</p>}
        </div>
    );
}
