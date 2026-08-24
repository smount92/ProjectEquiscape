"use client";

import { useState, useTransition } from "react";
import { setMembershipDisplay } from "@/app/actions/membership-display";

/**
 * MembershipDisplayToggle — a Pro/Studio member's opt-IN to show a
 * "Supporting Member" chip on their public profile. Rendered in Settings
 * only when the viewer's session tier is pro or studio.
 *
 * Default is OFF, by owner decision (2026-08-23): paid status is billing
 * information, and trust must never look purchasable — the chip is
 * deliberately a brass plaque, not a medal, so it never reads as the
 * earned curator ranks.
 */
export default function MembershipDisplayToggle({
    initialVisible,
}: {
    initialVisible: boolean;
}) {
    const [visible, setVisible] = useState(initialVisible);
    const [error, setError] = useState<string | null>(null);
    const [pending, startTransition] = useTransition();

    const handleChange = (next: boolean) => {
        setError(null);
        const previous = visible;
        setVisible(next);
        startTransition(async () => {
            const result = await setMembershipDisplay(next);
            if (!result.success) {
                setVisible(previous);
                setError(result.error || "Could not save your preference.");
            }
        });
    };

    return (
        <div className="text-left">
            <label className="flex cursor-pointer items-start gap-2 text-sm">
                <input
                    type="checkbox"
                    checked={visible}
                    disabled={pending}
                    onChange={(e) => handleChange(e.target.checked)}
                    className="mt-0.5 h-4 w-4 accent-(--brass)"
                />
                <span>
                    <span className="font-semibold text-foreground">
                        Show a &ldquo;Supporting Member&rdquo; chip on my profile
                    </span>
                    <span className="block text-xs text-secondary-foreground">
                        Off by default. It says you support the site — never which plan,
                        and it&rsquo;s separate from the curator medals you earn by
                        contributing.
                    </span>
                </span>
            </label>
            {error && <p className="mt-1 text-sm text-destructive">{error}</p>}
        </div>
    );
}
